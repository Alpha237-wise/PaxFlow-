// Mémoire intelligente pour l'équipage — docs/cahier-des-charges.md §4.5/§7.
// Same principle as known-people.ts but scoped by role too, since a name
// suggested for "Captain on board" shouldn't come from "Marine Hostess"
// history. Local cache only at this step; background sync is step 13.
import { getDb } from "./db";
import type { LocalKnownCrew } from "./db/schema";

export type CrewRole = "captain" | "mechanic" | "ab" | "marine_hostess";

export async function searchKnownCrew(
  ownerId: string,
  role: CrewRole,
  query: string,
  limit = 5,
): Promise<LocalKnownCrew[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const all = await getDb()
    .known_crew.where("owner_id")
    .equals(ownerId)
    .toArray();

  return all
    .filter((c) => c.role === role && c.name.toLowerCase().includes(q))
    .sort((a, b) => b.last_used_at.localeCompare(a.last_used_at))
    .slice(0, limit);
}

export async function rememberCrewMember(
  ownerId: string,
  role: CrewRole,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const db = getDb();
  const now = new Date().toISOString();

  const existing = await db.known_crew
    .where("owner_id")
    .equals(ownerId)
    .filter(
      (c) => c.role === role && c.name.trim().toLowerCase() === trimmed.toLowerCase(),
    )
    .first();

  await db.known_crew.put({
    id: existing?.id ?? crypto.randomUUID(),
    owner_id: ownerId,
    role,
    name: trimmed,
    last_used_at: now,
    created_at: existing?.created_at ?? now,
    sync_status: "pending",
  });
}
