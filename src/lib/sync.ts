// Synchronisation en arrière-plan — docs/cahier-des-charges.md §16.7,
// §21 step 13. Retry-based (event/interval triggered), no Background Sync
// API: it doesn't exist on iOS Safari at all, and the project owner
// confirmed (2026-08-20) building it wouldn't be worth it for a mostly
// single-device-at-a-time app — retry-on-focus/online/interval is the
// primary mechanism here, not a fallback.
//
// Scope: crossings/passengers are push-only (local -> Supabase); merging
// remote history is §21 step 14's job. known_people/known_crew are both
// pushed and pulled, since cross-device memory sharing is this feature's
// whole point (§4.5/§16.7) — conflicts resolve by last_used_at.
//
// Each push function is written out concretely rather than as one generic
// helper: Dexie's EntityTable<T, "id"> types don't unify cleanly across
// tables with a shared generic (the "id" primary-key inference varies per
// row shape), and fighting that adds more risk than four short, obviously
// correct functions.
import { createClient } from "./supabase/client";
import { getDb } from "./db";

// sync_status is local-only bookkeeping — Supabase's schema has no such
// column, so it must be stripped before upserting.
function withoutSyncStatus<T extends { sync_status: unknown }>(
  row: T,
): Omit<T, "sync_status"> {
  const { sync_status, ...rest } = row;
  void sync_status;
  return rest;
}

async function pushCrossings(): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  const pending = await db.crossings.where("sync_status").equals("pending").toArray();
  for (const row of pending) {
    const payload = withoutSyncStatus(row);
    try {
      const { error } = await supabase.from("crossings").upsert(payload);
      await db.crossings.update(row.id, { sync_status: error ? "error" : "synced" });
    } catch {
      // Network unreachable — leave "pending", the next trigger retries it.
    }
  }
}

async function pushPassengers(): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  const pending = await db.passengers.where("sync_status").equals("pending").toArray();
  for (const row of pending) {
    const payload = withoutSyncStatus(row);
    try {
      const { error } = await supabase.from("passengers").upsert(payload);
      await db.passengers.update(row.id, { sync_status: error ? "error" : "synced" });
    } catch {
      // Network unreachable.
    }
  }
}

async function pushKnownPeople(): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  const pending = await db.known_people.where("sync_status").equals("pending").toArray();
  for (const row of pending) {
    const payload = withoutSyncStatus(row);
    try {
      const { error } = await supabase.from("known_people").upsert(payload);
      await db.known_people.update(row.id, { sync_status: error ? "error" : "synced" });
    } catch {
      // Network unreachable.
    }
  }
}

async function pushKnownCrew(): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  const pending = await db.known_crew.where("sync_status").equals("pending").toArray();
  for (const row of pending) {
    const payload = withoutSyncStatus(row);
    try {
      const { error } = await supabase.from("known_crew").upsert(payload);
      await db.known_crew.update(row.id, { sync_status: error ? "error" : "synced" });
    } catch {
      // Network unreachable.
    }
  }
}

async function pullKnownPeople(userId: string): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("known_people")
      .select("*")
      .eq("owner_id", userId);
    if (error || !data) return;

    for (const r of data) {
      const local = await db.known_people.get(r.id);
      if (!local || new Date(r.last_used_at) > new Date(local.last_used_at)) {
        await db.known_people.put({ ...r, sync_status: "synced" });
      }
    }
  } catch {
    // Network unreachable.
  }
}

async function pullKnownCrew(userId: string): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("known_crew")
      .select("*")
      .eq("owner_id", userId);
    if (error || !data) return;

    for (const r of data) {
      const local = await db.known_crew.get(r.id);
      if (!local || new Date(r.last_used_at) > new Date(local.last_used_at)) {
        await db.known_crew.put({
          ...r,
          role: r.role as "captain" | "mechanic" | "ab" | "marine_hostess",
          sync_status: "synced",
        });
      }
    }
  } catch {
    // Network unreachable.
  }
}

export async function runSync(userId: string): Promise<void> {
  // Crossings before passengers: passengers.crossing_id is a foreign key,
  // the parent row must exist server-side first.
  await pushCrossings();
  await pushPassengers();
  await pushKnownPeople();
  await pushKnownCrew();
  await pullKnownPeople(userId);
  await pullKnownCrew(userId);
}
