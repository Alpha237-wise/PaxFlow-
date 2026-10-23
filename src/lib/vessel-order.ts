// Display order of the fleet. The boats are no longer all "BIRD n" (ARPM2
// joined 2026-10-22), so the earlier "first number in the name" sort would
// have put ARPM2 between BIRD 1 and BIRD 3. "BIRD n" boats keep their
// numeric order (BIRD 10 after BIRD 9, §5.1); every other name follows,
// alphabetically, whatever digits it contains.
const BIRD_NAME = /^BIRD\s+(\d+)$/i;

export function compareVesselNames(a: string, b: string): number {
  const na = BIRD_NAME.exec(a.trim());
  const nb = BIRD_NAME.exec(b.trim());
  if (na && nb) return Number(na[1]) - Number(nb[1]);
  if (na) return -1;
  if (nb) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}
