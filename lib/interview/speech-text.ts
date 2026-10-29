/**
 * Guards between the model's reply and the voice that reads it aloud.
 *
 * A small model can occasionally fall into a repetition loop — a run of
 * hundreds of commas, or its own instructions echoed back ("Do not use bullet
 * lists. Use paragraphs…"). The browser's speech engine reads every character,
 * so without these checks the candidate hears "comma, comma, comma…".
 *
 * Pure and dependency-free so it can be unit tested and used on both sides.
 */

/** Longest reply we will ever speak; real turns are 2-3 sentences. */
export const MAX_SPOKEN_CHARS = 600;

/** Phrases from our own prompt that must never reach the candidate. */
const LEAKED_INSTRUCTION =
  /\b(?:do not use (?:bullet|markdown|lists?)|use paragraphs instead|no markdown|spokenResponse|activeQuestionIndex|updatedState)\b/i;

/**
 * True when a reply is not usable speech: too long, mostly punctuation, a long
 * run of one character, a phrase repeated over and over, or leaked prompt text.
 */
export function isDegenerateReply(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length > MAX_SPOKEN_CHARS * 1.5) return true;
  // Eight of the same non-digit character in a row (",,,,,,,,"). Digits are
  // excluded so "1000000 requests" is fine.
  if (/([^0-9])\1{7,}/.test(t.replace(/\s+/g, ""))) return true;
  if (/(?:[^\w\s]\s*){6,}/.test(t)) return true; // ", , , , , ," with spaces

  const letters = (t.match(/[a-z]/gi) ?? []).length;
  if (letters / t.length < 0.6) return true;

  if (LEAKED_INSTRUCTION.test(t)) return true;

  // The same four-word phrase three or more times means the model is looping.
  const words = t.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(Boolean);
  const seen = new Map<string, number>();
  for (let i = 0; i + 4 <= words.length; i++) {
    const key = words.slice(i, i + 4).join(" ");
    const count = (seen.get(key) ?? 0) + 1;
    if (count >= 3) return true;
    seen.set(key, count);
  }
  return false;
}

/**
 * Remove what a speech engine would read literally — markdown, symbol runs,
 * stray brackets — and keep the text within a speakable length.
 */
export function cleanSpokenText(text: string): string {
  let t = text
    .replace(/[*_#`~>|]+/g, " ") // markdown
    .replace(/\[(?:[^\]]*)\]\([^)]*\)/g, " ") // [links](…)
    .replace(/\.{3,}/g, "…")
    .replace(/([,;:!?.…-])(?:\s*\1)+/g, "$1") // ",,,," → ","
    .replace(/\s+([,;:!?.…])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (t.length > MAX_SPOKEN_CHARS) {
    const cut = t.slice(0, MAX_SPOKEN_CHARS);
    // Prefer ending on a question, then on any sentence end.
    const end = Math.max(cut.lastIndexOf("?"), cut.lastIndexOf(". "), cut.lastIndexOf("! "));
    t = end > 80 ? cut.slice(0, end + 1).trim() : `${cut.trim()}…`;
  }
  return t;
}

/**
 * Split text into sentence-sized chunks for speech. Short utterances start
 * faster, can be skipped between, and avoid Chrome's habit of stalling on long
 * ones.
 */
export function splitIntoUtterances(text: string, maxLen = 220): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      // Very long sentence: break on commas so no single utterance is huge.
      if (current) {
        chunks.push(current);
        current = "";
      }
      let piece = "";
      for (const part of s.split(/(?<=,)\s+/)) {
        if ((piece + " " + part).trim().length > maxLen && piece) {
          chunks.push(piece.trim());
          piece = part;
        } else {
          piece = `${piece} ${part}`.trim();
        }
      }
      if (piece) chunks.push(piece.trim());
      continue;
    }
    if ((current + " " + s).trim().length > maxLen && current) {
      chunks.push(current);
      current = s;
    } else {
      current = `${current} ${s}`.trim();
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}
