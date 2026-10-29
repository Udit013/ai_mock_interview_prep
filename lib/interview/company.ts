/**
 * The optional company an interview is for ("Stripe", "Goldman Sachs").
 *
 * It's free text that ends up in prompts and on cards, so it is normalised and
 * restricted to characters a company name actually uses. Pure, so it's tested.
 */

export const MAX_COMPANY_CHARS = 60;

/** Trim, collapse spaces, drop anything that isn't plausible in a name. */
export function normalizeCompanyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[^\p{L}\p{N} &.,'()+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_COMPANY_CHARS)
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

/**
 * Match a typed company to a built-in company style, so typing "google"
 * applies the Google interview style without a second choice.
 */
export function matchCompanyMode<T extends { id: string; name: string }>(
  company: string | null | undefined,
  modes: T[]
): T | undefined {
  const key = company?.trim().toLowerCase();
  if (!key) return undefined;
  return modes.find((m) => m.id.toLowerCase() === key || m.name.toLowerCase() === key);
}

/** One or two letters for a monogram: "Goldman Sachs" → "GS", "Stripe" → "S". */
export function monogram(text: string): string {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

/** Stable palette index for a string, so a company keeps its colour. */
export function paletteIndex(text: string, size: number): number {
  let h = 0;
  for (const ch of text.toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % size;
}
