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
import { toLocalVessel } from "./db/schema";
import { pullManifestTemplate } from "./manifest-template";

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

// Reference data (read-only for regular users) — but unlike known_people/
// known_crew this had NO independent pull path before: it was only ever
// seeded into Dexie via the initialVessels prop the "/" Server Component
// happened to pass down on a successful load. If that load's cache never
// landed (first-ever visit with a flaky connection, or the service worker
// hadn't captured "/" yet), vessels stayed empty in IndexedDB forever and
// the BIRD chooser — the very first step of the workflow — had nothing to
// show offline. Confirmed as a real bug 2026-08-20; this closes the gap
// the same way known_people/known_crew already work.
async function pullVessels(): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("vessels")
      .select("id, name, total_seats, status, seat_layout_ref");
    if (error || !data) return;
    await db.vessels.bulkPut(data.map(toLocalVessel));
  } catch {
    // Network unreachable.
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

    const pendingDeleteIds = new Set(
      (await db.pending_deletes.where("table_name").equals("crossings").toArray()).map(
        (d) => d.id,
      ),
    );

    for (const r of data) {
      // Don't resurrect a row the AB just deleted locally but that hasn't
      // been removed server-side yet (still offline, or this pull raced
      // ahead of processPendingDeletes this same sync cycle).
      if (pendingDeleteIds.has(r.id)) continue;
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

    const pendingDeleteIds = new Set(
      (
        await db.pending_deletes.where("table_name").equals("known_people").toArray()
      ).map((d) => d.id),
    );

    for (const r of data) {
      if (pendingDeleteIds.has(r.id)) continue;
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

    const pendingDeleteIds = new Set(
      (
        await db.pending_deletes.where("table_name").equals("known_crew").toArray()
      ).map((d) => d.id),
    );

    for (const r of data) {
      if (pendingDeleteIds.has(r.id)) continue;
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

// Consumes the local delete queue (see LocalPendingDelete's docstring in
// db/schema.ts). Best-effort: leaves an entry queued if still offline, the
// next sync trigger retries it.
export async function processPendingDeletes(): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  const queued = await db.pending_deletes.toArray();
  for (const entry of queued) {
    try {
      const { error } = await supabase
        .from(entry.table_name)
        .delete()
        .eq("id", entry.id);
      if (!error) {
        await db.pending_deletes.delete(entry.id);
      }
    } catch {
      // Still offline — leave it queued.
    }
  }
}

// Deletes one crossing (History screen's per-row "Delete", §11 screen 11).
// Removes it locally immediately, queues the server-side delete, and makes
// one best-effort attempt right away in case the AB is online.
export async function deleteCrossing(crossingId: string): Promise<void> {
  const db = getDb();
  await db.passengers.where("crossing_id").equals(crossingId).delete();
  await db.crossings.delete(crossingId);
  await db.pending_deletes.put({
    id: crossingId,
    table_name: "crossings",
    created_at: new Date().toISOString(),
  });
  void processPendingDeletes();
}

// "Vider mon historique" (profile screen): every crossing/passenger this
// user owns, nothing else — known_people/known_crew are explicitly left
// alone (§4.7 — memory reset is a separate, stronger action).
export async function clearMyHistory(userId: string): Promise<void> {
  const db = getDb();
  const myCrossingIds = (
    await db.crossings.where("created_by").equals(userId).toArray()
  ).map((c) => c.id);

  for (const id of myCrossingIds) {
    await db.passengers.where("crossing_id").equals(id).delete();
  }
  await db.crossings.where("created_by").equals(userId).delete();

  const now = new Date().toISOString();
  await db.pending_deletes.bulkPut(
    myCrossingIds.map((id) => ({
      id,
      table_name: "crossings" as const,
      created_at: now,
    })),
  );
  void processPendingDeletes();
}

// Full reset (§4.7): everything "Vider mon historique" does, plus wipes
// the memory (known_people/known_crew) too. The two stay implemented as
// separate functions on purpose — this one is strictly a superset, never
// call it as a silent side effect of the lighter action.
export async function resetAllMyData(userId: string): Promise<void> {
  await clearMyHistory(userId);

  const db = getDb();
  const knownPeopleIds = (
    await db.known_people.where("owner_id").equals(userId).toArray()
  ).map((k) => k.id);
  const knownCrewIds = (
    await db.known_crew.where("owner_id").equals(userId).toArray()
  ).map((k) => k.id);

  await db.known_people.where("owner_id").equals(userId).delete();
  await db.known_crew.where("owner_id").equals(userId).delete();

  const now = new Date().toISOString();
  await db.pending_deletes.bulkPut([
    ...knownPeopleIds.map((id) => ({
      id,
      table_name: "known_people" as const,
      created_at: now,
    })),
    ...knownCrewIds.map((id) => ({
      id,
      table_name: "known_crew" as const,
      created_at: now,
    })),
  ]);
  void processPendingDeletes();
}

export async function runSync(userId: string): Promise<void> {
  // Process queued deletes before any pull, so a delete that just went
  // through server-side isn't briefly re-pulled by the checks below (they
  // also guard against it independently, but this ordering avoids relying
  // on that alone).
  await processPendingDeletes();

  // Vessels first and on its own: the BIRD chooser is the first screen of
  // the whole workflow, so this cache matters more than anything else
  // here being fully up to date yet.
  await pullVessels();

  // Same reasoning as vessels: the manifest template is reference data
  // every crossing needs to export, so cache it early rather than after
  // the push/pull cycle below.
  await pullManifestTemplate();

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
