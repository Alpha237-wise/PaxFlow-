// Writing colour of the text injected on the generated manifest
// (docs/cahier-des-charges.md §9.7). A per-USER setting (stored on the AB's
// profile, not on a crossing), purely cosmetic: it never reaches the
// classification engine or any business rule, and there is deliberately ONE
// colour for everything a given AB writes — no TM/CC distinction (the
// Department/Company columns already tell them apart).
//
// Three dark, low-saturation inks, all legible on the form's light
// background. Navy is the original colour and the default, so an AB who
// never opens this setting sees no change at all.
export type ManifestInk = "navy" | "green" | "burgundy";

export const DEFAULT_MANIFEST_INK: ManifestInk = "navy";

export const MANIFEST_INKS: Record<ManifestInk, { label: string; color: string }> = {
  navy: { label: "Bleu marine", color: "#0a2472" },
  green: { label: "Vert bouteille", color: "#0d4a33" },
  burgundy: { label: "Bordeaux", color: "#6b1428" },
};

export const MANIFEST_INK_KEYS = Object.keys(MANIFEST_INKS) as ManifestInk[];

export function isManifestInk(value: unknown): value is ManifestInk {
  return typeof value === "string" && value in MANIFEST_INKS;
}

// Anything unknown/missing (no profile cached yet, a value from a future
// version) falls back to the default navy rather than breaking the export.
export function manifestInkColor(ink: string | null | undefined): string {
  return MANIFEST_INKS[isManifestInk(ink) ? ink : DEFAULT_MANIFEST_INK].color;
}
