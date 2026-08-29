/**
 * Cleans and validates the question set an LLM returns, so a bad generation
 * never reaches the interview screen.
 *
 * Observed failure modes this guards against:
 *  - numbering leaking into the text ("1. Tell me about…", "Q2: …")
 *  - markdown bullets / stray quotes
 *  - near-duplicate questions ("What is an index?" vs "What is an index")
 *  - fragments too short to be a real question
 *  - the model returning fewer questions than asked
 *
 * Pure and dependency-free so it is unit-testable.
 */

/** Shorter than this and it isn't a usable interview question. */
const MIN_QUESTION_LENGTH = 15;
/** Guards against a runaway generation producing an essay as one "question". */
const MAX_QUESTION_LENGTH = 2000;

/** Strip list markers, numbering, and wrapping quotes the model may emit. */
function stripDecoration(raw: string): string {
  return raw
    .replace(/^\s*(?:[-*•>]+\s*)+/, "") // bullets
    .replace(/^\s*(?:Q(?:uestion)?\s*)?\d+\s*[.):\]-]\s*/i, "") // 1. / Q2: / 3)
    .replace(/^["'“”`]+|["'“”`]+$/g, "") // wrapping quotes
    .replace(/\s+/g, " ")
    .trim();
}

/** Comparison key for duplicate detection: casing/punctuation-insensitive. */
function dedupeKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SanitizedQuestions {
  questions: string[];
  /** Human-readable notes about what was dropped, for server-side logging. */
  issues: string[];
}

/**
 * Normalize, de-duplicate, and filter a raw question list.
 * Never throws — callers decide whether the surviving count is acceptable.
 */
export function sanitizeQuestions(raw: unknown): SanitizedQuestions {
  const issues: string[] = [];

  if (!Array.isArray(raw)) {
    return { questions: [], issues: ["Model did not return a list."] };
  }

  const seen = new Set<string>();
  const questions: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") {
      issues.push("Dropped a non-string entry.");
      continue;
    }

    const cleaned = stripDecoration(item);

    if (cleaned.length < MIN_QUESTION_LENGTH) {
      issues.push(`Dropped too-short entry: "${cleaned.slice(0, 40)}"`);
      continue;
    }

    const key = dedupeKey(cleaned);
    if (!key) {
      issues.push("Dropped an entry with no alphanumeric content.");
      continue;
    }
    if (seen.has(key)) {
      issues.push(`Dropped duplicate: "${cleaned.slice(0, 40)}"`);
      continue;
    }

    seen.add(key);
    questions.push(cleaned.slice(0, MAX_QUESTION_LENGTH));
  }

  return { questions, issues };
}

/**
 * How many questions we're willing to run an interview with. Asking for 8 and
 * getting 6 usable ones is fine; getting 1 is not, and the user is better served
 * by a clear error than a broken interview.
 */
export function meetsMinimumCount(count: number, requested: number): boolean {
  if (count === 0) return false;
  // Accept a shortfall, but never fewer than 3 and never under half of the ask.
  const floor = Math.max(3, Math.ceil(requested / 2));
  return count >= Math.min(floor, requested);
}
