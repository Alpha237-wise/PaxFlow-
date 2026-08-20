@AGENTS.md

# PaxFlow

Prototype personnel : PWA offline-first pour un AB (Able Seaman) qui saisit les manifestes de traversée de catamarans de transport de personnel (TM/Contractor).

**Cahier des charges complet et source de vérité fonctionnelle : `docs/cahier-des-charges.md`.** Le lire avant toute modification touchant aux règles métier, au modèle de données, ou à l'ordre d'implémentation (§21). Toute divergence entre le code et ce document doit être signalée, pas silencieusement contournée.

## Règles métier critiques (ne jamais réinventer/deviner)

**Classification TM / Contractor (cahier des charges §4.1)** — calculée automatiquement, jamais laissée à une saisie libre :

| `company_id_number` | `company_name` | Classification |
|---|---|---|
| renseigné | indifférent | TM |
| vide | vide (seul `department` rempli) | TM (Director/Manager, new joiner) |
| vide | renseigné | Contractor (CC) |

- Toujours stocker `classification_computed` (résultat de la règle) ET `classification_final` (après override manuel éventuel) + `classification_overridden` — jamais un seul champ.
- Le moteur de classification s'exécute **côté client**, en JS pur, sans dépendance réseau (voir §16.7 offline-first). Le serveur ne recalcule jamais seul — il persiste ce que le client a calculé.
- Guests et équipage (Captain/Mechanic/AB/Marine Hostess) sont informatifs uniquement : **jamais comptés** dans les totaux TM/CC, ni dans le résumé WhatsApp, ni dans le manifeste.

**Offline-first (§16.6/16.7)** — exigence non négociable :
- Toute la chaîne (création traversée, saisie sièges/passagers, classification, totaux, résumé, PDF/image) doit fonctionner intégralement sans réseau, à partir d'IndexedDB (Dexie.js) comme source de vérité locale.
- **Seule l'action "Partager sur WhatsApp" nécessite le réseau.**
- Écriture locale d'abord, toujours ; synchronisation Supabase en arrière-plan, best-effort, avec repli sur retry simple si Background Sync API indisponible (notamment iOS Safari).
- Résolution de conflit multi-appareils : last-write-wins par `updated_at`, au niveau enregistrement (pas au niveau champ).

**Manifeste et résumé — rendu déterministe uniquement (§9.1/§9.5)** :
- Jamais de génération via un LLM pour le manifeste ou le résumé. Template fixe + données injectées telles quelles, sans reformulation.
- Manifeste : tableau dynamique (uniquement les sièges occupés, pas de lignes vides), pas de logo d'entreprise.
- Résumé WhatsApp : **deux messages séparés** (décision validée 2026-08-20), formats exacts en §8.1 du cahier des charges.

**Rétention des données (§15.1/§4.7)** :
- `crossings`/`passengers` : purge automatique à 30 jours (`expires_at`, cascade).
- `known_people`/`known_crew` (mémoire intelligente) : **jamais purgés automatiquement**, strictement privés par utilisateur (`owner_id`), persistent indéfiniment sauf réinitialisation manuelle explicite par l'utilisateur.

**Sécurité** :
- RLS Postgres sur toutes les tables utilisateur, jamais de sécurité reposant sur le masquage UI seul (§13).
- `SUPABASE_SERVICE_ROLE_KEY` jamais exposée côté client.

## Contrainte d'architecture — Server Components vs offline (important, à ne pas casser)

Les Server Components Next.js s'exécutent côté serveur : ils exigent que l'appareil atteigne le serveur Vercel, ce qui est impossible en pleine mer sans réseau, même avec un Service Worker qui met en cache l'app shell. `/login` et `/` (dashboard léger) sont volontairement des Server Components car ils supposent déjà une connexion (connexion initiale, écran d'accueil informatif).

**Mais tout l'enchaînement opérationnel critique du §16.7** (choix du BIRD utilisé en mer, création de traversée, plan des sièges, classification, synthèse, résumé, manifeste — §21 étapes 5 à 12) **doit être construit en Client Components** qui chargent leurs données de référence une fois (ex. liste des vessels) puis travaillent uniquement contre IndexedDB (Dexie.js, §16.1) une fois l'app shell mis en cache par le Service Worker. Ne pas transformer ces écrans en Server Components avec fetch Supabase à chaque navigation — ça romprait le fonctionnement hors-ligne exigé par les critères d'acceptation (§19).

## Piège de test — Vercel Deployment Protection

Les URLs uniques de déploiement (`paxflow-<hash>-alpha237-wise1.vercel.app`) sont protégées par la Vercel Deployment Protection (SSO Vercel), ce qui casse les `fetch()` internes (dont le Service Worker) avec des erreurs CORS pointant vers `vercel.com/sso-api`. **Toujours tester en conditions réelles sur l'URL stable `https://paxflow-hazel.vercel.app`** (non protégée), ou en local (`npm run dev` / `npm run build && npm run start`). Ce n'était pas un bug applicatif (§21 étape 13, 2026-08-20) — le moteur de sync fonctionnait, seule l'URL de test était en cause.

## Ordre d'implémentation

Suivre l'ordre du §21 du cahier des charges sauf instruction contraire explicite du porteur de projet.
