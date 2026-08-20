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

async function pullCrossings(userId: string): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  try {
    // Explicitly scoped to this user's own crossings, not whatever RLS
    // additionally allows an admin/super_admin to SELECT — "my history"
    // must only ever cache locally what's actually mine (§13.2).
    const { data, error } = await supabase
      .from("crossings")
      .select("*")
      .eq("created_by", userId);
    if (error || !data) return;

    for (const r of data) {
      const local = await db.crossings.get(r.id);
      if (!local || new Date(r.updated_at) > new Date(local.updated_at)) {
        await db.crossings.put({
          ...r,
          status: r.status as "draft" | "finalized",
          sync_status: "synced",
        });
      }
    }
  } catch {
    // Network unreachable.
  }
}

async function pullPassengers(crossingIds: string[]): Promise<void> {
  if (crossingIds.length === 0) return;
  const db = getDb();
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("passengers")
      .select("*")
      .in("crossing_id", crossingIds);
    if (error || !data) return;

    for (const r of data) {
      const local = await db.passengers.get(r.id);
      if (!local || new Date(r.updated_at) > new Date(local.updated_at)) {
        await db.passengers.put({
          ...r,
          classification_computed: r.classification_computed as "TM" | "CC",
          classification_final: r.classification_final as "TM" | "CC",
          sync_status: "synced",
        });
      }
    }
  } catch {
    // Network unreachable.
  }
}

// Mirrors the server-side 30-day purge (§15.1) locally, so a device's own
// history view honestly reflects the retention window even between syncs.
// The server-side pg_cron job is the actual source of truth for deletion;
// this just keeps the local cache from drifting out of sync with it.
export async function purgeExpiredLocal(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const expired = await db.crossings.where("expires_at").below(now).toArray();
  for (const c of expired) {
    await db.passengers.where("crossing_id").equals(c.id).delete();
    await db.crossings.delete(c.id);
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

  // Pull remote crossings/passengers for "historique personnel (local +
  // distant fusionnés)" — §21 step 14. Re-read local crossing ids after
  // pulling so passengers are fetched for the full merged set, not just
  // whatever was newly pulled this round.
  await pullCrossings(userId);
  const myCrossingIds = (
    await getDb().crossings.where("created_by").equals(userId).toArray()
  ).map((c) => c.id);
  await pullPassengers(myCrossingIds);

  await pullKnownPeople(userId);
  await pullKnownCrew(userId);

  await purgeExpiredLocal();
}
