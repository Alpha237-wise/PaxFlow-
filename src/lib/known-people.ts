// Mémoire intelligente — docs/cahier-des-charges.md §4.5. Local cache only
// at this step (§21 step 8); pushing to Supabase in the background is
// built generically for every syncable table at §21 step 13, not here.
import { getDb } from "./db";
import type { LocalKnownPerson } from "./db/schema";

export interface PersonDetails {
  name: string;
  companyIdNumber: string | null;
  department: string | null;
  companyName: string | null;
}

export async function searchKnownPeople(
  ownerId: string,
  query: string,
  limit = 5,
): Promise<LocalKnownPerson[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const all = await getDb()
    .known_people.where("owner_id")
    .equals(ownerId)
    .toArray();

  return all
    .filter((p) => p.name.toLowerCase().includes(q))
    .sort((a, b) => b.last_used_at.localeCompare(a.last_used_at))
    .slice(0, limit);
}

// Reverse lookup: matricule -> name/department. TM-only by construction —
// a Company ID Number is the classification rule's (§4.1) most reliable
// per-person identifier (two TMs never share one, unlike names), while CC
// never has one filled in at all, so this naturally never matches a CC.
// Exact match (not substring, unlike searchKnownPeople): a matricule
// either is or isn't this person's.
export async function searchKnownPeopleByCompanyId(
  ownerId: string,
  companyIdNumber: string,
  limit = 5,
): Promise<LocalKnownPerson[]> {
  const q = companyIdNumber.trim();
  if (!q) return [];

  const all = await getDb()
    .known_people.where("owner_id")
    .equals(ownerId)
    .toArray();

  return all
    .filter((p) => p.company_id_number === q)
    .sort((a, b) => b.last_used_at.localeCompare(a.last_used_at))
    .slice(0, limit);
}

// Upserts by (owner_id, company_id_number) when there is one, since two TMs
// never share a matricule (§4.1) — that's the reliable identity for that
// category. Homonyms (same name, different matricule) must stay as
// separate known_people rows, or the second one entered would silently
// overwrite the first's remembered details. Falls back to (owner_id, name)
// only for the path with no matricule at all (CC, or a Director/Manager/
// new-joiner TM) — there's no better identifier available there, and that
// fallback only ever matches other no-matricule rows, so it can't clobber
// a TM's memory that happens to share a name with a CC/new-joiner.
export async function rememberPerson(
  ownerId: string,
  details: PersonDetails,
): Promise<void> {
  const db = getDb();
  const name = details.name.trim();
  if (!name) return;
  const now = new Date().toISOString();
  const companyIdNumber = details.companyIdNumber?.trim() || null;

  const existing = companyIdNumber
    ? await db.known_people
        .where("owner_id")
        .equals(ownerId)
        .filter((p) => p.company_id_number === companyIdNumber)
        .first()
    : await db.known_people
        .where("owner_id")
        .equals(ownerId)
        .filter(
          (p) =>
            !p.company_id_number &&
            p.name.trim().toLowerCase() === name.toLowerCase(),
        )
        .first();

  await db.known_people.put({
    id: existing?.id ?? crypto.randomUUID(),
    owner_id: ownerId,
    name,
    company_id_number: companyIdNumber,
    department: details.department,
    company_name: details.companyName,
    last_used_at: now,
    created_at: existing?.created_at ?? now,
    sync_status: "pending",
    sync_error: null,
  });
}
