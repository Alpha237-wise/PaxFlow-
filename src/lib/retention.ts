// Retention window for crossings/passengers (docs/cahier-des-charges.md
// §15.1): 14 days since 2026-10-15 (24 hours from 2026-09-10, 30 days
// before that). Single source of truth for the client side — the value
// stamped into crossings.expires_at at creation (offline-first, §16.7: set
// by the client, not just by the column default) and the wording shown to
// the user. The database default in
// supabase/migrations/20261015100000_crossings_retention_14d.sql must stay
// equal to this. known_people/known_crew are never purged (§4.5/§15.1).
export const CROSSING_RETENTION_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export function crossingExpiresAt(fromMs: number = Date.now()): string {
  return new Date(fromMs + CROSSING_RETENTION_DAYS * DAY_MS).toISOString();
}
