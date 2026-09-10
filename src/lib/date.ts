// "YYYY-MM-DD" in the browser's own local timezone — Date.toISOString()
// alone would give UTC's date, which is wrong for anyone west of
// Greenwich in the evening (or east of it just after midnight).
export function todayLocalISODate(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
