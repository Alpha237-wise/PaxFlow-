# PaxFlow — Cahier des Charges Fonctionnel et Technique

**Version :** 1.2 (document de référence pour développement — toutes ambiguïtés résolues)
**Rédigé par :** Claude, en tant que Software/Product Architect
**Destiné à :** Claude Code (implémentation) et au porteur de projet (validation)
**Statut :** Validé par le porteur de projet le 2026-08-20. Développement en cours, ordre du §21.

### Décisions prises lors de la validation (2026-08-20)
- **§8.1 — Format WhatsApp** : deux messages séparés (pas un seul texte à deux blocs). Chaque bloc a son propre bouton Copier/Partager.
- **§12 — Schéma `vessels`** : la colonne `operational_seats` est retirée des migrations (résidu d'une règle de capacité abandonnée en v1.1 — voir §4.4, aucune distinction de capacité opérationnelle n'est appliquée).
- **§5 — Plan de sièges** : le visuel de référence sera déposé par le porteur de projet dans `docs/reference/`. À utiliser à l'étape 7 du §21 pour construire le composant Seat Map.

### Changelog v1.1 → v1.2
Sur la base d'un second exemple réel de manifeste rempli et d'une capture d'écran du résumé WhatsApp réellement utilisé, les derniers points ont été tranchés :
1. **Mémoire intelligente** : confirmée strictement privée par AB, non soumise à la purge 30 jours.
2. **Vessel Name** : confirmé auto-rempli depuis le BIRD choisi.
3. **Purge 30 jours** : confirmée applicable uniquement aux traversées (`crossings`/`passengers`), jamais à la mémoire du personnel. Ajout d'une option de réinitialisation manuelle complète (§4.7).
4. **Multi-appareils** : confirmé comme cas d'usage standard dès la V1 (raison d'être de Supabase), stratégie de synchronisation renforcée en conséquence (§16.7).
5. **Format exact du résumé WhatsApp** précisé à partir d'un exemple réel (§8.1).
6. **Format exact du manifeste généré** précisé : tableau dynamique selon le nombre réel de passagers, plus uniquement Guests et nom de la Marine Hostess en complément (§9.2).

**Toutes les ambiguïtés recensées sont désormais résolues (§22).**

---

## 0. Résumé exécutif

PaxFlow est une application mobile-first destinée à un AB (Able Seaman) opérant des catamarans de transport de personnel entre une base et des sites offshore/insulaires. Elle remplace la saisie papier d'un manifeste de traversée par une saisie numérique unique, dont découlent automatiquement : la classification TM/Contractor, les statistiques par département/company, le résumé texte pour WhatsApp, et un manifeste numérique généré de façon déterministe (PDF/image), fidèle à la structure du document papier de référence (sans logo ni identité visuelle de l'entreprise).

Le projet démarre comme un prototype personnel (1 utilisateur réel, le porteur de projet, en Super Admin), mais l'architecture (auth, rôles, RLS, multi-bateaux, multi-utilisateurs) est conçue dès la V1 pour supporter une adoption progressive par d'autres AB, sans refonte technique majeure.

---

## 1. Objectifs du produit

### 1.1 Objectif principal
Permettre à un AB de saisir une seule fois les informations d'une traversée et des passagers, et de laisser l'application produire automatiquement tous les livrables aujourd'hui faits manuellement : classification, comptages, résumé WhatsApp, manifeste numérique.

### 1.2 Objectifs secondaires
- Réduire le temps de saisie à chaque traversée grâce à une mémoire intelligente.
- Fournir une base de données fiable et traçable des traversées (historique, audit).
- Préparer, sans la construire immédiatement, une architecture capable d'accueillir plusieurs AB, plusieurs bateaux, et un rôle de supervision (Admin).
- Ne jamais compromettre la confidentialité des données transportées (identité, matricule, société).

### 1.3 Non-objectifs (explicitement hors V1)
- Gestion fine et dynamique des plans de sièges par configuration (V1 utilise des plans fixes par type de BIRD, voir §5).
- Suivi individuel des Guests et de l'équipage dans les totaux (ils sont enregistrés mais non comptés, §4.2/§7/§8).
- Génération du manifeste par IA générative (interdit, voir §9.1 — le rendu doit être déterministe).
- Signature électronique, validation réglementaire officielle, intégration à un système compagnie existant.
- Notifications push.
- Conservation des données au-delà de 30 jours (purge automatique, voir §15).

**Note :** contrairement à une V1 "cloud-only" initialement envisagée, le fonctionnement **hors-ligne est désormais un objectif V1 indispensable** (voir §16.6/16.7) — ce n'est plus une exclusion.

---

## 2. Personas et rôles

| Persona | Rôle système | Contexte d'usage |
|---|---|---|
| AB (porteur de projet, utilisateur initial) | USER (puis SUPER ADMIN techniquement, voir remarque ci-dessous) | Utilise l'app en opération, sur mobile, pour chaque traversée. |
| Futur AB collègue (V1.1+) | USER | Même usage, compte propre, ne voit que ses données. |
| Port Captain / Safety Officer / Capitaine désigné (futur) | ADMIN | Supervision en lecture seule, promu manuellement. |
| Porteur de projet en tant que gestionnaire technique | SUPER ADMIN | Gestion des comptes, des bateaux, des paramètres, supervision globale. |

**Remarque importante :** au lancement, le porteur de projet cumule dans les faits deux casquettes (AB opérationnel qui saisit des manifestes, et Super Admin qui gère le système). Ce sont deux rôles fonctionnels distincts même s'ils sont portés par la même personne/le même compte. Le modèle de permissions doit être conçu comme si USER et SUPER ADMIN étaient deux comptes différents, même si en V1 un seul compte cumule les deux (le Super Admin peut créer des manifestes comme un USER — il n'est pas exclu de la fonction opérationnelle).

---

## 3. Cas d'usage principaux

1. **UC1 — Créer une traversée.** L'AB se connecte, choisit un BIRD, crée une nouvelle traversée, saisit les informations générales (date, heures, ports, vessel name).
2. **UC2 — Saisir les passagers.** L'AB sélectionne un siège sur le plan, saisit nom / matricule / département / (le cas échéant) compagnie externe. L'app suggère des personnes déjà connues.
3. **UC3 — Classifier automatiquement.** Le moteur détermine TM ou Contractor selon les règles métier (§4.1). L'AB peut corriger manuellement une classification.
4. **UC4 — Saisir l'équipage.** Captain on board, Mechanic, AB, Marine Hostess — informatif uniquement, non comptabilisé dans les totaux.
5. **UC5 — Saisir les Guests (optionnel).** Un champ numérique facultatif, non comptabilisé dans les totaux TM/CC.
6. **UC6 — Consulter les totaux en temps réel.** Total TM, Total CC, répartition par département/company, mise à jour en direct pendant la saisie.
7. **UC7 — Générer le résumé.** Texte structuré prêt à copier ou partager sur WhatsApp.
8. **UC8 — Générer le manifeste numérique.** Rendu PDF et image, structure fidèle au document papier, sans logo.
9. **UC9 — Consulter l'historique.** L'AB retrouve ses traversées passées ; recherche par date/BIRD.
10. **UC10 — Admin : superviser.** Consultation en lecture des manifestes et historiques, sans droit de modification.
11. **UC11 — Super Admin : administrer.** Gestion des comptes, rôles, bateaux, paramètres système.
12. **UC12 — Réinitialiser ses données.** L'utilisateur peut réinitialiser manuellement et intégralement ses données (traversées ET mémoire intelligente), via une action de confirmation explicite dans son profil (voir §4.7). Indépendant de la purge automatique à 30 jours, qui ne concerne que les traversées (§15.1).

---

## 4. Règles métier

### 4.1 Classification automatique TM / Contractor — **règle révisée (v1.1)**

Clarification apportée par le porteur de projet, confirmée par un exemple réel de manifeste rempli : un Director/Manager est toujours un TM (c'est un chef de département), et il existe aussi fréquemment des **new joiners** (nouveaux employés) qui n'ont pas encore de matricule. Sur le manifeste réel, les lignes TM affichent un matricule **et** un département, tandis que les lignes Contractor affichent un département **et** le nom d'une compagnie externe, mais jamais de matricule. Par respect, l'AB ne demande pas de matricule à un Director/Manager ou à un new joiner.

Pour rendre cette règle fiable sans recourir à une case dédiée ni à une détection de mots-clés fragile, le champ unique « Department/Company » du papier est **scindé en deux champs de saisie** côté application :

| Champ | Description |
|---|---|
| `department` | Département interne (ex. FNB, Rec, Eng, Spa, HK, Fin, IT, Kit, FO) — toujours saisi. |
| `company_name` | Nom de la compagnie externe/contractante — rempli **uniquement** si la personne est un contractor externe (ex. Segafredo, Shisha, UHS, ORIX, Valet). Vide pour un TM. |

**Règle de classification :**

| Matricule (`company_id_number`) | `company_name` renseigné ? | Classification |
|---|---|---|
| Renseigné | Indifférent | **TM** |
| Vide | Vide (seul le département est renseigné) | **TM** *(couvre Director/Manager et new joiner)* |
| Vide | Renseigné | **Contractor (CC)** |

- Aucune case « Director/Manager » n'est nécessaire : un Director/Manager ou un new joiner sans matricule est naturellement classé TM dès lors qu'aucune compagnie externe n'est renseignée — ce qui est le cas puisqu'ils appartiennent en interne à un département.
- La classification calculée est toujours affichée mais **modifiable manuellement** par l'AB (champ `classification_override`), pour les cas exceptionnels qui ne suivraient pas la règle. Le système conserve la classification calculée ET la classification finale retenue, à des fins d'audit (voir §14).
- Cette scission en 2 champs reste rapide à saisir (2 champs texte courts au lieu d'un seul) et supprime toute ambiguïté d'interprétation pour le moteur, contrairement à une détection de mots-clés dans un champ unique.
- **Confirmé (2026-08-20) par un exemple réel** (`docs/reference/whatsapp-summary-example.jpg`) : le résumé WhatsApp observé (39TM/12cc) correspond exactement à cette règle — les entrées "département seul, sans compagnie" (ex. "7fnb", "3Eng") sont comptées TM, les entrées "compagnie" ou "département/compagnie" (ex. "1valet", "1kit/uhs") sont comptées CC. Sur le papier, l'AB combine parfois département et compagnie en une seule notation abrégée ("Kit/UHS") — dans l'app, l'AB doit bien saisir "Kit" dans `department` et "UHS" dans `company_name` séparément, pas la chaîne combinée dans un seul champ.

### 4.2 Guests — **révisé (v1.1) : non prioritaire**
- Champ numérique optionnel par traversée : `total_guests`. Aucune donnée individuelle.
- Confirmé par le porteur de projet : les Guests **ne sont pas comptés** dans les totaux affichés dans le résumé WhatsApp ni dans le manifeste — seuls TM et CC sont totalisés (§8). Le champ reste disponible pour information mais n'entre dans aucun calcul métier.

### 4.3 Regroupement par département/company
- Le champ `department_or_company` est du texte libre (pas de liste fermée), pour ne jamais bloquer une saisie.
- Le regroupement pour le résumé se fait par **normalisation légère** de la valeur saisie (trim, casse insensible) pour éviter que « ACME » et « acme » créent deux groupes distincts, sans toutefois forcer une correspondance stricte avec une liste prédéfinie.
- La mémoire intelligente (§4.5) réutilise les valeurs déjà saisies pour cette même personne comme suggestion, ce qui réduit naturellement les variations orthographiques dans le temps.

### 4.4 Sièges et capacité — **révisé (v1.1) : aucun blocage**
- Chaque BIRD a un plan de sièges fixe (voir §5 pour le détail visuel tiré du document).
- BIRD 1 à BIRD 8 : 51 sièges. BIRD 9 et BIRD 10 : 50 sièges.
- Confirmé par le porteur de projet : dans la pratique, une traversée remplit toujours moins de 51 places, donc **aucune limite de capacité n'est appliquée ni bloquée** dans l'application — pas de distinction "capacité opérationnelle" à 48 pour BIRD 9/10, pas de sièges désignés comme indisponibles.
- Le sélecteur de bateau **propose les 10 BIRD** ; l'AB choisit librement celui utilisé. Le statut « hors service » (ex. BIRD 10 en réparation) reste une information disponible mais n'empêche plus la sélection — un simple badge visuel d'avertissement suffit (l'AB reste en pratique le mieux placé pour savoir quel bateau il utilise réellement).

### 4.5 Mémoire intelligente — **résolu (v1.1)**
- Dès qu'un passager est enregistré avec succès dans une traversée, ses informations (nom, matricule, département, compagnie externe) sont retenues dans une table de « personnes connues » associée à l'utilisateur qui les a saisies.
- Lors d'une nouvelle saisie, dès que l'AB tape 2-3 caractères d'un nom, l'app propose les correspondances issues des personnes connues, avec préremplissage des autres champs (matricule, département, compagnie) que l'AB peut librement modifier.
- Le même principe s'applique à l'équipage (Captain, Mechanic, AB, Marine Hostess) : mémorisation des noms déjà saisis pour suggestion future.
- **Confirmé : la mémoire est strictement privée par compte AB.** Chaque utilisateur ne voit que les personnes qu'il a lui-même déjà enregistrées. Pas de mémoire partagée entre AB en V1.
- **Confirmé : cette mémoire n'est PAS soumise à la purge des 30 jours** (voir §15.1) — elle persiste indéfiniment, sauf réinitialisation manuelle explicite par l'utilisateur (voir §4.7).

### 4.6 Correction et immutabilité
- Un manifeste peut être modifié par son créateur tant qu'il n'est pas explicitement « finalisé/verrouillé » (proposition : un statut `draft` → `finalized`).
- Une fois `finalized`, les modifications restent possibles mais génèrent une entrée d'audit (qui, quand, quoi) — pas de blocage strict en V1, sauf demande contraire.

### 4.7 Réinitialisation manuelle des données — **nouveau (v1.1)**
En complément de la purge automatique à 30 jours (§15.1, qui ne concerne que les traversées), l'utilisateur doit disposer d'une option explicite dans son profil pour **tout réinitialiser manuellement**, y compris sa mémoire intelligente (`known_people`/`known_crew`), s'il le souhaite (ex. changement de méthode de travail, nettoyage volontaire). Cette action est irréversible, protégée par une confirmation explicite (ex. saisie du mot "SUPPRIMER"), et journalisée dans `audit_log`.

---

## 5. Sièges et flotte — modèle détaillé

**Confirmé (2026-08-20) à partir des photos réelles du manifeste papier** (`docs/reference/seat-plan-blank-manifest.jpg` et `seat-plan-filled-example.jpg`) — remplace la description approximative de la v1.0/v1.2, qui était basée sur une explication textuelle avant réception des photos.

Le plan de sièges réel (gabarit `51-seats`, BIRD 1 à 8) est composé de **3 blocs**, dans l'ordre où ils apparaissent sur le bateau à partir du poste de pilotage (« BOAT CAPTAIN ») :

| Bloc | Sièges | Disposition |
|---|---|---|
| A (près du capitaine) | 1 à 18 | 9 rangées de 2 sièges (paires) : (1,2), (3,4) … (17,18) |
| B (au centre) | 19 à 33 | 5 rangées de 3 sièges (triplets) : (19,20,21), (22,23,24) … (31,32,33) |
| C | 34 à 51 | 9 rangées de 2 sièges (paires) : (34,35), (36,37) … (50,51) |

Total : 18 + 15 + 18 = 51 sièges. C'est ce layout qui sert de gabarit visuel au composant « Seat Map » (boutons larges, un seul tap pour sélectionner un siège vide, tap pour éditer un siège occupé — voir §16.6).

**Gabarit `50-seats` (BIRD 9 et 10) : non confirmé par photo, approximation provisoire.** En l'absence de photo de référence pour cette variante, le gabarit reprend la même structure que le 51 places en retirant un siège au bloc C (8 paires + 1 siège seul au lieu de 9 paires). À corriger dès qu'une photo réelle du plan BIRD 9/10 est disponible — décision explicite du porteur de projet : « on pourra modifier après » (2026-08-20).

### 5.1 Modèle de données proposé pour la flotte
```
vessels
  id
  name              -- "BIRD 1" ... "BIRD 10"
  total_seats        -- 51 ou 50 (informatif, aucun blocage appliqué — voir §4.4)
  status              -- 'active' | 'out_of_service' (informatif, badge uniquement, ne bloque pas la sélection)
  seat_layout_ref     -- référence au gabarit de plan (V1 : 2 gabarits, "51-seats" et "50-seats")
  created_at / updated_at
```
- Le plan de sièges lui-même (positions x/y, regroupements visuels) est stocké comme configuration statique côté frontend en V1 (2 gabarits : 51 places, 50 places), et non recréé dynamiquement en base — cela évite une complexité inutile pour un nombre de configurations aussi limité (10 bateaux, 2 gabarits). Une évolution future pourrait déplacer ce gabarit en base si la flotte diversifie ses configurations.

### 5.2 Importance fonctionnelle du numéro de siège
Le siège reste l'identifiant primaire de chaque ligne du manifeste (comme sur le papier). Il est indexé et consultable rapidement (ex. recherche future « qui était au siège 12 le 14 août » pour un objet perdu) — cette recherche n'est pas un écran V1 dédié mais la donnée est structurée pour le permettre facilement en V1.1.

---

## 6. Informations de traversée (saisie manuelle)

Champs, tous obligatoires sauf mention contraire, texte libre pour les champs non fermés :

| Champ | Type | Remarque |
|---|---|---|
| Date | date | |
| Time of Departure | heure | |
| Port of Origin | texte libre | pas de liste fermée imposée |
| Vessel Name | auto-rempli depuis le BIRD sélectionné | **confirmé** — voir note ci-dessous |
| Time of Arrival | heure | peut être renseignée a posteriori |
| Destination | texte libre | |

**Confirmé (v1.1) :** le choix du BIRD à l'étape précédente du workflow remplit automatiquement le Vessel Name (le nom de chaque BIRD étant déjà connu du système), avec possibilité de modification manuelle par l'AB si besoin. Note d'implémentation : sur les exemples réels fournis, l'AB abrège parfois le nom en écriture manuscrite (ex. « B1 » pour BIRD 1) — le champ auto-rempli peut afficher la forme complète (« BIRD 1 ») tout en restant éditable pour respecter les habitudes d'écriture si souhaité.

---

## 7. Équipage

Champs texte libre avec autocomplete (mémoire intelligente, §4.5) :
- Captain on board
- Mechanic
- AB (l'AB qui remplit le manifeste peut être préchargé comme valeur par défaut à partir du compte connecté, modifiable)
- Marine Hostess

---

## 8. Résumé automatique (pour WhatsApp)

### 8.1 Format précis — **résolu (v1.1), basé sur exemple réel fourni**

Le porteur de projet a fourni une capture d'écran de son usage réel actuel (copié-collé manuellement dans le groupe WhatsApp « Marine Operations »). PaxFlow doit reproduire fidèlement cette structure, en **deux messages séparés** (décision validée le 2026-08-20 — chaque bloc a son propre bouton Copier/Partager, plutôt qu'un seul texte à deux blocs).

**Message 1 — Résumé + photo du manifeste :**
```
<Port of Origin> to <Destination>
<Total TM>TM
<Total CC> cc
Mh <nom Marine Hostess>
Capt <nom Captain on board> team
```
suivi du **manifeste généré (image ou PDF)** en pièce jointe.

**Message 2 — Répartition par département :**
```
<Vessel Name abrégé, ex. B1>
<département 1>: <effectif TM>
<département 2>: <effectif TM>
...

<département/compagnie 1>: <effectif CC>
<département/compagnie 2>: <effectif CC>
...
```
- La première liste (avant la ligne vide) reprend les **TM regroupés par département**.
- La seconde liste (après la ligne vide) reprend les **CC regroupés par département/compagnie**, exactement comme demandé : *« PaxFlow me donne aussi le nombre de personnes par département, les TM au-dessus et les CC en dessous »*.
- Guests et équipage (hors Captain/MH déjà cités en message 1) **n'apparaissent pas** dans ce résumé, conformément à la règle §4.2/§8.

### 8.2 Actions
- **Copier** : copie le texte formaté de chaque message (bouton séparé par message) dans le presse-papier.
- **Partager sur WhatsApp** : utilise l'API de partage native du téléphone (Web Share API) pour ouvrir WhatsApp avec le texte et, si le format de partage le permet, le manifeste en pièce jointe ; l'utilisateur choisit lui-même le destinataire/groupe final et valide l'envoi. Aucun envoi automatique déclenché côté serveur — c'est la seule étape de tout le parcours qui nécessite une connexion réseau (voir §16.7).

### 8.3 Contrôle avant partage
Le résumé est affiché à l'écran avant toute action de copie/partage — l'AB doit pouvoir revenir en arrière pour corriger une saisie si un total semble incorrect.

---

## 9. Génération du manifeste numérique

### 9.1 Principe
Rendu **déterministe** : un template fixe dans lequel les données saisies sont injectées programmatiquement (pas de génération par un modèle génératif d'image ou de texte).

### 9.2 Contenu précis — **résolu (v1.1), basé sur exemple réel fourni**
Confirmé par le porteur de projet à partir d'un second exemple réel de manifeste rempli :
- **Tableau des sièges dynamique** : contrairement au papier qui affiche toujours 51 lignes (même vides), le manifeste généré par PaxFlow n'affiche que les lignes correspondant aux **passagers réellement saisis** (Seat / Name / Company ID Number / Department ou Department+Company selon TM/CC) — pas de lignes vides.
- **Deux champs complémentaires, et rien d'autre** : nombre de Guests, et nom de la Marine Hostess (MH).
- Le reste des informations de traversée (date, heures, ports, vessel) reste affiché en en-tête, comme précédemment spécifié en §6.
- **Non inclus dans ce document généré** : la grille de codes/cases à cocher visible en haut à droite sur l'exemple papier fourni (ex. « FNB:☑1, HK:☑1, Rec:☑☑1... ») — il s'agit d'un usage interne de l'AB sans lien avec les règles métier de PaxFlow, non reproduit.
- Captain on board / Mechanic / AB restent enregistrés en base (§7) mais n'apparaissent pas nécessairement sur ce document individuel — ils sont utilisés pour le résumé WhatsApp (§8.1, ligne "Capt ... team").

### 9.3 Formats de sortie
- **PDF** : pour archivage, généré côté client (voir §16.1/16.7 — fonctionnement hors-ligne), jamais par un LLM.
- **Image (PNG/JPG)** : rendu du même template pour partage rapide.

### 9.4 Contraintes visuelles V1
- **Pas de logo**, pas d'identité graphique de l'entreprise. Un en-tête neutre type « PaxFlow — Manifest » suffit.
- Structure inspirée de la mise en page papier (colonnes Seat / Name / Company ID Number / Department), mais **redimensionnée dynamiquement** au nombre réel de passagers (§9.2) plutôt que reproduite à l'identique avec ses 51 lignes fixes.

### 9.5 Fiabilité
Aucune altération possible des données injectées : le template est un gabarit figé, les données viennent strictement de la base/du stockage local, aucune reformulation ou "amélioration" automatique du texte saisi (nom, matricule) n'est appliquée.

---

## 10. Workflow cible (résumé)

```
Connexion
 → Choisir le BIRD
 → Créer une traversée (infos générales)
 → Renseigner les sièges/passagers (avec suggestions mémoire intelligente)
 → Classification automatique TM/CC (corrections possibles)
 → Renseigner équipage (informatif)
 → Renseigner Total Guests (optionnel, informatif)
 → Contrôle des effectifs TM/CC (vue de synthèse en direct)
 → Génération du manifeste (PDF/Image)
 → Génération du résumé (texte)
 → Vérification manuelle
 → Copier / Partager WhatsApp / Télécharger PDF / Télécharger Image
 → Sauvegarde automatique dans l'historique
```

---

## 11. Écrans nécessaires (V1)

1. **Connexion / Inscription** (email + mot de passe via Supabase Auth).
2. **Accueil / Choix du BIRD** (liste des bateaux actifs, statut visible).
3. **Nouvelle traversée — Infos générales** (formulaire date/heures/ports/vessel).
4. **Plan des sièges** (grille tactile, sièges occupés/libres, tap pour ouvrir la fiche passager).
5. **Fiche passager** (modal/bottom-sheet : nom, matricule, département, compagnie externe le cas échéant, classification affichée en lecture, override possible — voir §4.1).
6. **Équipage** (formulaire simple, 4 champs avec autocomplete, informatif).
7. **Guests** (un champ numérique optionnel, informatif).
8. **Synthèse / Contrôle des effectifs** (totaux TM/CC en direct, répartition par département).
9. **Résumé généré** (texte, boutons Copier / Partager WhatsApp).
10. **Manifeste généré** (aperçu PDF/Image, boutons Télécharger PDF / Télécharger Image).
11. **Historique** (liste des traversées passées de l'utilisateur, filtrable par date/BIRD, ouverture en lecture).
12. **Profil / Paramètres utilisateur** (déconnexion, réinitialisation de ses données mémorisées).
13. **(Admin) Supervision** — vue lecture seule des manifestes/historique global, sans actions de modification.
14. **(Super Admin) Administration** — gestion utilisateurs/rôles, gestion des bateaux (statut, capacité), vue d'audit.

---

## 12. Modèle de données proposé (Supabase / PostgreSQL)

```sql
-- Utilisateurs : gérés par Supabase Auth (auth.users)
-- Table de profil applicatif, 1-1 avec auth.users
profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  role text not null default 'user' check (role in ('user','admin','super_admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

vessels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- "BIRD 1" ... "BIRD 10"
  total_seats int not null,
  status text not null default 'active' check (status in ('active','out_of_service')),
  seat_layout_ref text not null,      -- '51-seats' | '50-seats'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
-- NOTE (validé 2026-08-20) : pas de colonne operational_seats — §4.4 confirme
-- qu'aucune distinction de capacité opérationnelle n'est appliquée en V1.

crossings (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid references vessels(id),
  created_by uuid references profiles(id) not null,
  status text not null default 'draft' check (status in ('draft','finalized')),
  crossing_date date not null,
  time_of_departure time,
  time_of_arrival time,
  port_of_origin text,
  destination text,
  vessel_name_override text,          -- si l'AB modifie le nom auto-rempli
  captain_on_board text,              -- informatif, non comptabilisé
  mechanic text,                      -- informatif, non comptabilisé
  ab_name text,                       -- informatif, non comptabilisé
  marine_hostess text,                -- informatif, non comptabilisé
  total_guests int,                   -- optionnel, informatif, non comptabilisé (voir §4.2)
  expires_at timestamptz not null default (now() + interval '30 days'),  -- purge automatique, voir §15
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

passengers (
  id uuid primary key default gen_random_uuid(),
  crossing_id uuid references crossings(id) on delete cascade,
  seat_number int not null,
  name text not null,
  company_id_number text,
  department text,                    -- département interne (ex. FNB, Rec, Eng, Spa, HK, Fin, IT, Kit, FO)
  company_name text,                  -- compagnie externe du contractor, vide pour un TM — voir §4.1
  classification_computed text not null check (classification_computed in ('TM','CC')),
  classification_final text not null check (classification_final in ('TM','CC')),
  classification_overridden boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (crossing_id, seat_number)
)

known_people (            -- mémoire intelligente, privée par utilisateur (voir §4.5), PAS soumise à la purge 30 jours
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) not null,
  name text not null,
  company_id_number text,
  department text,
  company_name text,
  last_used_at timestamptz default now(),
  created_at timestamptz default now()
)

known_crew (               -- même logique pour les suggestions équipage
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) not null,
  role text not null check (role in ('captain','mechanic','ab','marine_hostess')),
  name text not null,
  last_used_at timestamptz default now()
)

audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,              -- 'crossing.create', 'crossing.update', 'role.change', ...
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
)
```

Notes :
- `classification_computed` conserve toujours le résultat du moteur de règles ; `classification_final` est ce qui est réellement utilisé (identique sauf override).
- Les totaux (Total TM, Total CC) ne sont **pas stockés** en colonnes dédiées : ils sont **calculés à la volée** par requête/vue, pour éviter toute désynchronisation. Une vue SQL `crossing_summary` peut être créée pour cela.
- `expires_at` sur `crossings` est utilisée par une tâche planifiée (voir §15) pour purger automatiquement les traversées de plus de 30 jours ; `passengers` est purgé en cascade via `on delete cascade`.
- Le calcul du moteur de classification (§4.1) doit être **exécuté côté client** (JavaScript pur, sans dépendance réseau) pour fonctionner hors-ligne (voir §16.6), puis simplement synchronisé/persisté tel quel côté serveur — jamais recalculé uniquement côté serveur comme source de vérité unique.

---

## 13. Architecture Supabase — Auth, RLS, permissions

### 13.1 Authentification
- Supabase Auth, email + mot de passe pour la V1 (suffisant pour un usage interne restreint). Pas de SSO nécessaire à ce stade.
- Un trigger Postgres crée automatiquement une ligne `profiles` (role = 'user') à l'inscription. Le passage en `super_admin` du tout premier compte se fait manuellement en base (script de bootstrap), jamais via l'interface.

### 13.2 Principes RLS
- RLS activée sur **toutes** les tables contenant des données utilisateur (`crossings`, `passengers`, `known_people`, `known_crew`).
- **USER** : peut SELECT/INSERT/UPDATE/DELETE uniquement les lignes dont `created_by` (ou `owner_id`) = `auth.uid()`.
- **ADMIN** : peut SELECT sur toutes les lignes de `crossings`/`passengers` (supervision), aucune écriture. Pas d'accès à `known_people`/`known_crew` des autres utilisateurs (mémoire intelligente = strictement privée, y compris pour l'Admin, sauf décision contraire explicite).
- **SUPER ADMIN** : accès complet en lecture/écriture sur `crossings`, `passengers`, `vessels`, `profiles` (gestion des rôles), `audit_log`. Accès en lecture à `known_people`/`known_crew` réservé aux opérations de maintenance justifiées (à traiter au cas par cas, jamais par défaut dans l'UI standard).
- Les policies RLS doivent être écrites en SQL (migrations versionnées, voir §16.5), jamais gérées uniquement côté frontend.
- Le rôle stocké dans `profiles.role` est lu côté RLS via une fonction `auth.uid()` + jointure, jamais fait confiance à une valeur envoyée par le client.

### 13.3 Élévation de privilèges
- Seule une opération exécutée par un `super_admin` (vérifiée côté policy RLS sur la table `profiles`) peut modifier la colonne `role` d'un autre profil. Un `admin` ne peut jamais modifier de rôle, y compris le sien.
- Chaque changement de rôle génère une entrée dans `audit_log`.

---

## 14. Traçabilité / Audit

Événements minimums à journaliser dans `audit_log` :
- Création / modification d'une traversée (`crossing.create`, `crossing.update`) avec `actor_id`, timestamp.
- Modification d'un passager, notamment tout `classification_overridden` (utile pour comprendre a posteriori pourquoi une règle automatique a été contournée).
- Changement de rôle (`role.change`), avec l'ancien et le nouveau rôle en `metadata`.
- Changement de statut d'un bateau (`vessel.status_change`).
- Suppression de données (`data.delete`), quel que soit l'objet.

Cette table n'est pas exposée en écriture directe côté client : elle est alimentée par des triggers Postgres ou par la couche serveur, jamais par une simple requête frontend, pour éviter toute falsification.

---

## 15. Confidentialité et sécurité

- RLS stricte comme décrit en §13 — jamais de sécurité reposant uniquement sur le masquage d'un bouton dans l'UI.
- Aucune clé/API secret côté client ; utilisation exclusive de la clé publique (anon key) + RLS pour les opérations utilisateur, et clé de service réservée aux fonctions serveur (Edge Functions) si nécessaire pour des opérations d'administration sensibles.
- Les données nominatives (nom, matricule) sont considérées sensibles : pas de log applicatif contenant ces données en clair dans des outils tiers non maîtrisés (ex. pas d'envoi à un service d'analytics externe).
- Chiffrement : Supabase chiffre les données au repos et en transit par défaut (TLS) ; aucune configuration supplémentaire requise en V1, mais à documenter comme dépendance de la plateforme.

### 15.1 Politique de rétention — **résolu (v1.1) : purge automatique à 30 jours, traversées uniquement**
Confirmé par le porteur de projet : pour limiter le volume stocké (et le coût associé sur Supabase), les données de traversée (`crossings` + `passengers` en cascade) — c'est-à-dire les « fichiers créés » — sont **automatiquement supprimées 30 jours après leur création**.

**Confirmé : cette purge ne s'applique PAS aux détails du personnel** (`known_people`/`known_crew`, la mémoire intelligente). Ces données persistent indéfiniment tant que l'utilisateur ne les réinitialise pas manuellement (voir §4.7).

Mise en œuvre recommandée :
- Colonne `expires_at` sur `crossings` (voir §12), initialisée à `created_at + 30 jours`.
- Une tâche planifiée quotidienne (`pg_cron` sur Supabase, ou une Supabase Edge Function déclenchée par un scheduler) supprime les lignes `crossings` dont `expires_at < now()` ; la suppression cascade automatiquement vers `passengers`. `known_people`/`known_crew` ne sont jamais concernés par cette tâche.
- L'historique (UC9, écran §11.11) ne montrera donc que les 30 derniers jours de traversées — ce point doit être communiqué clairement à l'utilisateur dans l'UI (ex. bandeau "historique conservé 30 jours").
- Une option de **réinitialisation manuelle complète** (y compris de la mémoire intelligente) reste disponible dans le profil utilisateur, voir §4.7.

---

## 16. Architecture technique

### 16.1 Vue d'ensemble — **révisé (v1.1) : offline-first requis dès la V1**
Confirmé par le porteur de projet : l'application doit fonctionner **entièrement hors-réseau** pendant la saisie et la génération des documents. **Seul le partage WhatsApp nécessite une connexion réseau** (ce qui est de toute façon une contrainte de WhatsApp lui-même, pas de PaxFlow).

- **Frontend** : PWA (Progressive Web App) mobile-first (recommandation : Next.js/React, déployée sur Vercel), installable sur l'écran d'accueil, utilisable aussi sur desktop.
- **Stockage local** : IndexedDB (via une librairie comme Dexie.js) comme source de vérité **pendant la traversée en cours** — création de traversée, saisie des sièges/passagers, classification, calcul des totaux, génération du résumé texte et du manifeste PDF/image se font **entièrement côté client, sans appel réseau**.
- **Synchronisation** : dès que le réseau redevient disponible, les traversées créées/modifiées localement sont synchronisées vers Supabase (Postgres) en arrière-plan. Tant qu'une traversée n'est pas synchronisée, elle reste consultable localement (historique local).
- **Backend** : Supabase (Postgres + Auth + Storage), utilisé pour la persistance durable, la mémoire intelligente partagée entre sessions/appareils, l'audit, et la supervision Admin/Super Admin — mais jamais comme dépendance bloquante pour la saisie opérationnelle en mer.
- **Génération de documents** : librairie déterministe de rendu HTML→PDF **exécutée côté client** (ex. génération PDF dans le navigateur), pas de dépendance à un LLM ni au réseau pour cette étape.
- **Dépôt de code** : GitHub, source de vérité, dès le premier commit.
- **CI/CD** : Vercel (preview deployments automatiques par pull request, déploiement production sur merge vers `main`).

### 16.2 Organisation Git/GitHub
- Dépôt unique `paxflow`.
- Branches : `main` (production), `develop` (optionnel selon préférence), branches de feature nommées `feature/xxx`.
- Convention de commits recommandée : Conventional Commits (`feat:`, `fix:`, `chore:`...) pour faciliter la lecture de l'historique par Claude Code sur la durée.
- Un fichier `CLAUDE.md` à la racine du repo doit référencer ce cahier des charges et rappeler les règles métier critiques (classification TM/CC, contraintes de rendu déterministe du manifeste) pour que Claude Code les retrouve facilement à chaque session.

### 16.3 Migrations Supabase
- Toutes les évolutions de schéma passent par des fichiers de migration SQL versionnés dans `/supabase/migrations`, exécutés via la Supabase CLI.
- Interdiction de modifier le schéma uniquement depuis le dashboard Supabase en production sans migration correspondante committée.

### 16.4 Environnements
- **Développement/Preview** : projet Supabase séparé (ou schéma logique séparé a minima) + déploiements Vercel preview automatiques par PR.
- **Production** : projet Supabase dédié, déploiement Vercel sur `main` uniquement.
- Variables d'environnement gérées via Vercel (jamais committées), avec un fichier `.env.example` documentant les clés nécessaires sans valeurs réelles.

### 16.5 Secrets
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` : exposables côté client (par design Supabase), protection réelle assurée par RLS.
- `SUPABASE_SERVICE_ROLE_KEY` : jamais exposée côté client, utilisée uniquement dans des fonctions serveur (Edge Functions / API routes serveur) pour des opérations d'administration explicitement nécessaires.

### 16.6 Mobile-first
- Grille de sièges optimisée tactile (zones de tap ≥ 44px), formulaire passager en bottom-sheet pour saisie rapide au pouce, champs texte avec clavier adapté (numérique pour matricule si pertinent).
- PWA dès la V1 (voir §16.7), installable sur l'écran d'accueil, icône dédiée, fonctionnement en plein écran sans barre de navigateur.

### 16.7 Connectivité — **révisé (v1.1) : offline-first requis dès la V1**
Le contexte opérationnel (traversée en mer, connectivité faible/inexistante) impose que **toute la chaîne de saisie et de génération fonctionne sans réseau**. Seule l'action finale « Partager sur WhatsApp » nécessite une connexion (contrainte de WhatsApp, hors du contrôle de PaxFlow).

Conséquences architecturales :
- **Authentification** : la session Supabase Auth doit être mise en cache localement (token persistant) pour permettre à l'AB de rester connecté sans réseau après une première connexion réussie.
- **Écriture locale d'abord** : toute création/modification (traversée, passager, résumé, manifeste) est écrite dans IndexedDB en premier ; la synchronisation vers Supabase est une opération asynchrone, best-effort, réessayée automatiquement dès que le réseau revient (Service Worker + Background Sync API, avec repli sur un simple retry au retour au premier plan si Background Sync n'est pas disponible sur la plateforme).
- **Mémoire intelligente hors-ligne** : les personnes déjà connues doivent être mises en cache localement (copie locale de `known_people`/`known_crew` synchronisée en arrière-plan) pour que l'autocomplete fonctionne aussi sans réseau.
- **Conflits de synchronisation** : **confirmé (v1.1) — l'utilisation multi-appareils est prévue dès la V1** (le même compte utilisateur peut être utilisé depuis plusieurs téléphones, raison même du choix de Supabase comme backend synchronisé). Stratégie recommandée : chaque enregistrement (`crossings`, `passengers`, `known_people`) porte un `updated_at` ; à la synchronisation, la version la plus récente par `updated_at` l'emporte (last-write-wins au niveau enregistrement, pas au niveau champ). Comme un même AB ne travaille normalement pas sur la même traversée simultanément depuis deux appareils, le risque de conflit réel reste faible, mais la mécanique doit être prévue et testée dès la V1 plutôt que reportée.
- **Génération PDF/Image et résumé** : entièrement calculés côté client à partir des données locales, jamais dépendants d'un appel serveur.
- **Indicateur d'état** : l'UI doit clairement indiquer si une traversée est "en attente de synchronisation" ou "synchronisée", pour rassurer l'AB sur le fait que ses données ne sont pas perdues même hors-ligne.

---

## 17. Exigences non fonctionnelles

- **Performance de saisie** : ajout d'un passager en moins de 3 interactions (tap siège → recherche/sélection ou saisie → validation).
- **Fonctionnement hors-ligne** : la saisie, la classification, les totaux, le résumé et la génération du manifeste PDF/Image doivent fonctionner intégralement sans connexion réseau (voir §16.7). Seul le partage WhatsApp requiert le réseau.
- **Disponibilité** : dépendante de Supabase/Vercel pour la synchronisation et la supervision (SLA standard des plateformes), mais l'usage opérationnel principal (saisie en mer) ne dépend pas de leur disponibilité en temps réel.
- **Accessibilité** : contraste suffisant, tailles de police lisibles en extérieur/luminosité forte (contexte bateau).
- **Compatibilité** : navigateurs mobiles récents (Safari iOS, Chrome Android) en priorité.
- **Internationalisation** : anglais comme langue par défaut de l'interface (cohérent avec le document de référence en anglais), pas de nécessité multilingue en V1.

---

## 18. Stratégie de tests

- **V1 minimal viable** : tests manuels réels par le porteur de projet en conditions opérationnelles (1-2 mois), complétés par :
  - tests unitaires sur le moteur de classification TM/CC (règles métier critiques, §4.1) ;
  - tests unitaires sur le calcul des totaux/regroupements par département ;
  - test d'intégration sur la génération du manifeste (vérifier qu'aucune donnée n'est altérée entre saisie et rendu PDF/image) ;
  - tests des policies RLS (vérifier qu'un USER ne peut jamais lire les données d'un autre USER, qu'un ADMIN ne peut jamais écrire).
- Pas de couverture exhaustive exigée en V1 ; priorité aux zones à risque (règles métier, sécurité des données, intégrité du manifeste généré).

---

## 19. Critères d'acceptation V1

- [ ] Un AB peut se connecter, créer une traversée sur n'importe quel BIRD (y compris BIRD 9/10), saisir au moins 1 passager, et voir sa classification calculée correctement selon les 3 cas de §4.1.
- [ ] Les totaux (TM, CC uniquement) affichés à l'écran de synthèse sont exacts et se mettent à jour en direct.
- [ ] Le résumé généré peut être copié et partagé via WhatsApp (ouverture de l'app WhatsApp avec texte prérempli), et ne compte que TM/CC.
- [ ] Le manifeste PDF et l'image générés reprennent fidèlement toutes les données saisies, sans altération, sans logo de l'entreprise.
- [ ] **La saisie complète d'une traversée (infos générales, sièges, classification, totaux, résumé, manifeste PDF/image) fonctionne en mode avion / sans réseau, du début à la fin.**
- [ ] Une traversée créée hors-ligne se synchronise automatiquement avec Supabase dès le retour du réseau, sans perte ni duplication.
- [ ] Un second compte utilisateur ne peut ni voir ni modifier les traversées d'un autre compte (vérifié via tentative directe, pas seulement via l'UI).
- [ ] Un compte Admin peut consulter mais jamais modifier les données d'un autre utilisateur.
- [ ] Un changement de rôle n'est possible que par un Super Admin et est journalisé dans `audit_log`.
- [ ] Une traversée de plus de 30 jours est automatiquement supprimée de la base et n'apparaît plus dans l'historique.
- [ ] L'historique des traversées de l'utilisateur connecté (sur les 30 derniers jours) est consultable et filtrable au minimum par date.

---

## 20. Découpage V1 / V1.1 / Futur

### V1 — indispensable
- Auth (email/mdp) avec session mise en cache localement, rôles USER/ADMIN/SUPER ADMIN avec RLS complète.
- Gestion des 10 BIRD (statut informatif, aucun blocage — voir §4.4).
- **PWA offline-first** : création de traversée, saisie des sièges/passagers, classification automatique + override manuel, calcul des totaux TM/CC, génération résumé et manifeste — tout fonctionne sans réseau (voir §16.7).
- Synchronisation automatique en arrière-plan vers Supabase dès le retour réseau.
- Saisie équipage et Guests (informatif, non comptabilisé).
- Écran de synthèse en direct (TM/CC uniquement).
- Génération résumé (copier/partager WhatsApp — seule étape nécessitant le réseau).
- Génération manifeste PDF + image, rendu déterministe côté client, sans logo.
- Historique personnel de l'utilisateur (30 derniers jours, purge automatique — voir §15).
- Mémoire intelligente privée par utilisateur (personnes + équipage), disponible hors-ligne via cache local, non soumise à la purge 30 jours.
- Audit log des opérations sensibles.

### V1.1 — améliorations proches
- Recherche dans l'historique par nom de passager (utile pour objets perdus, §5.2).
- Éventuelle mémoire intelligente partagée entre AB, si validée et si le besoin se confirme après les 1-2 mois de test.
- Écran Admin de supervision plus riche (filtres, export).
- Résolution de conflits de synchronisation plus fine si usage multi-appareil avéré.

### Futur (post-adoption élargie)
- Gestion dynamique et détaillée des plans de sièges (configuration par bateau en base plutôt que gabarits statiques).
- Intégration éventuelle avec un système RH/compagnie existant pour préremplir les matricules/départements officiels.
- Export/statistiques consolidées multi-traversées, multi-bateaux (tableau de bord) — nécessitera de revoir la purge à 30 jours si des statistiques longue durée sont souhaitées.
- Éventuelle identité visuelle officielle si le produit est adopté formellement par l'entreprise (ajout du logo, à ce moment-là avec autorisation explicite).

---

## 21. Ordre recommandé d'implémentation pour Claude Code

1. Initialisation du repo GitHub, structure du projet (Next.js en PWA), connexion Supabase (projet dev), premières migrations (`profiles`, `vessels`, trigger de création de profil).
2. Auth (inscription/connexion) avec persistance de session locale, bootstrap manuel du premier Super Admin.
3. Migration `crossings` (avec `expires_at`), `passengers` (avec `department`/`company_name`), `known_people`, `known_crew`, `audit_log` + policies RLS complètes, avec tests RLS avant de continuer.
4. Mise en place du stockage local (IndexedDB/Dexie.js) et du moteur de classification (§4.1) **côté client**, indépendant du réseau.
5. Écran Choix du BIRD + gestion des bateaux (seed des 10 BIRD, statut informatif uniquement).
6. Écran Nouvelle traversée (infos générales), écriture locale d'abord.
7. Composant Plan des sièges (2 gabarits statiques, 51 et 50 places) + fiche passager avec moteur de classification exécuté localement.
8. Mémoire intelligente (cache local + autocomplete sur `known_people`/`known_crew`, synchronisation en arrière-plan).
9. Équipage + Guests (champs informatifs).
10. Écran de synthèse en direct (calcul des totaux TM/CC entièrement local).
11. Génération du résumé texte (client-side) + actions Copier/Partager WhatsApp.
12. Génération du manifeste (template déterministe, rendu PDF/image côté client).
13. Synchronisation en arrière-plan (Service Worker + Background Sync ou retry simple) vers Supabase, avec indicateur d'état "synchronisé/en attente".
14. Historique personnel (local + distant fusionnés), purge automatique 30 jours côté serveur (`pg_cron`/Edge Function planifiée).
15. Écran Admin (lecture seule globale) et écran Super Admin (gestion utilisateurs/rôles/bateaux).
16. Mise en place de l'audit log sur l'ensemble des opérations sensibles identifiées en §14.
17. Passage en environnement de production (projet Supabase prod, déploiement Vercel prod) une fois la V1 validée en usage réel par le porteur de projet.

---

## 22. Synthèse des ambiguïtés — **toutes résolues (v1.1)**

Toutes les ambiguïtés identifiées en v1.0 et v1.1 ont été levées par le porteur de projet :

1. ~~Director/Manager~~ → résolu par la scission `department`/`company_name`, voir §4.1.
2. ~~BIRD 9/10 — sièges exclus~~ → résolu : aucun blocage, voir §4.4.
3. ~~Total général du résumé (équipage/guests inclus ?)~~ → résolu : seuls TM+CC comptent, voir §8.1.
4. ~~Durée de conservation des données~~ → résolu : purge automatique à 30 jours sur les traversées uniquement, mémoire intelligente conservée indéfiniment, réinitialisation manuelle disponible, voir §15.1 et §4.7.
5. ~~Connectivité en mer~~ → résolu : offline-first requis dès la V1, voir §16.7.
6. ~~Mémoire intelligente — portée~~ → résolu : strictement privée par AB, voir §4.5.
7. ~~Vessel Name~~ → résolu : auto-rempli depuis le BIRD choisi, voir §6.
8. ~~Statut "hors service" d'un BIRD~~ → résolu : badge informatif uniquement, aucun blocage, confirmé sans changement (§4.4).
9. ~~Multi-appareil~~ → résolu : usage multi-appareils prévu et supporté dès la V1 via Supabase, voir §16.7.

**Aucune ambiguïté bloquante ne subsiste.** Le développement peut démarrer sur la base de ce document dès validation finale par le porteur de projet.

---

*Fin du cahier des charges V1.2. Toutes les ambiguïtés sont résolues (§22). Développement validé le 2026-08-20, en cours d'implémentation selon l'ordre du §21.*
