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

// Upserts by (owner_id, name) — the memory recalls a name's most recently
// used details, not a strict per-person identity (no matricule-based dedup;
// matches the spec's stated goal of speeding up repeat entry, not building
// an HR directory).
export async function rememberPerson(
  ownerId: string,
  details: PersonDetails,
): Promise<void> {
  const db = getDb();
  const name = details.name.trim();
  if (!name) return;
  const now = new Date().toISOString();

  const existing = await db.known_people
    .where("owner_id")
    .equals(ownerId)
    .filter((p) => p.name.trim().toLowerCase() === name.toLowerCase())
    .first();

  await db.known_people.put({
    id: existing?.id ?? crypto.randomUUID(),
    owner_id: ownerId,
    name,
    company_id_number: details.companyIdNumber,
    department: details.department,
    company_name: details.companyName,
    last_used_at: now,
    created_at: existing?.created_at ?? now,
    sync_status: "pending",
  });
}
