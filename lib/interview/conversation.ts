/**
 * Deterministic helpers that keep the interview sounding like a person rather
 * than a questionnaire: near-duplicate detection, repeated-opener tracking,
 * and varied scripted lines (opening, transitions).
 *
 * Pure and dependency-free so it can be unit tested and used on both the
 * server (prompt building, guards) and the client (scripted opening).
 */

const STOPWORDS = new Set(
  (
    "a an the and or but if then so of to in on at for from by with about as " +
    "is are was were be been being do does did have has had can could would " +
    "should will shall may might must you your yours i me my we our us they " +
    "them their it its this that these those what which who whom whose how " +
    "why when where there here please tell describe explain walk through give " +
    "example some any one way ways like just also more most very really " +
    "let lets us talk discuss share approach"
  ).split(" ")
);

/** Crude stemmer: enough to match "caching"/"cache", "indexes"/"index". */
function stem(word: string): string {
  return word
    .replace(/(?:ing|ed|es|s)$/, "")
    .replace(/e$/, "");
}

/** Meaningful word stems of a sentence. */
export function contentTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem)
    .filter(Boolean);
  return new Set(tokens);
}

/** Jaccard similarity of content words, 0 (unrelated) to 1 (same words). */
export function questionSimilarity(a: string, b: string): number {
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

/** Above this, two questions are asking the same thing in different words. */
export const NEAR_DUPLICATE_THRESHOLD = 0.6;

export function isNearDuplicate(
  candidate: string,
  others: string[],
  threshold = NEAR_DUPLICATE_THRESHOLD
): boolean {
  return others.some((o) => questionSimilarity(candidate, o) >= threshold);
}

/** The question(s) inside an interviewer line — the sentences ending in "?". */
export function extractQuestions(line: string): string[] {
  return (line.match(/[^.!?]*\?/g) ?? []).map((q) => q.trim()).filter(Boolean);
}

/**
 * First few words of each recent interviewer line. Fed back to the model so it
 * stops opening every turn with the same "That's a great point…".
 */
export function recentOpeners(
  history: { role: string; content: string }[],
  count = 4,
  words = 4
): string[] {
  return history
    .filter((m) => m.role === "assistant")
    .slice(-count)
    .map((m) =>
      m.content
        .replace(/\[Problem shown on screen\][\s\S]*/, "")
        .trim()
        .split(/\s+/)
        .slice(0, words)
        .join(" ")
    )
    .filter((s) => s.length > 0);
}

/** Questions the interviewer has already asked, for "never re-ask" checks. */
export function askedQuestions(
  history: { role: string; content: string }[]
): string[] {
  return history
    .filter((m) => m.role === "assistant")
    .flatMap((m) => extractQuestions(m.content));
}

const pick = <T,>(list: readonly T[], seed: number): T =>
  list[((seed % list.length) + list.length) % list.length];

const OPENING_GREETINGS = [
  (name: string) => `Hi ${name}, thanks for making the time today.`,
  (name: string) => `Hey ${name}, good to meet you.`,
  (name: string) => `Hi ${name}, welcome — glad we could do this.`,
] as const;

const OPENING_FRAMES = [
  (role: string, n: number) =>
    `I'll be running your ${role} interview. We'll go through ${n} main ${n === 1 ? "topic" : "topics"}, and I'll dig into your answers as we go, so think of it as a conversation rather than a quiz.`,
  (role: string, n: number) =>
    `This is a ${role} interview — ${n} main ${n === 1 ? "area" : "areas"} to cover, with follow-ups wherever something you say is worth exploring.`,
  (role: string, n: number) =>
    `For this ${role} interview I've got ${n} ${n === 1 ? "topic" : "topics"} in mind, and I'll follow your lead where it gets interesting.`,
] as const;

const OPENING_REASSURANCES = [
  "Take a moment before answering if you need it, and thinking out loud is completely fine.",
  "There's no rush — feel free to think out loud.",
  "If anything's unclear, just ask me to rephrase.",
] as const;

const FIRST_QUESTION_LEADS = [
  "Let's start here:",
  "To kick things off:",
  "I'd like to start with this:",
] as const;

/**
 * Spoken opening for a voice (non-coding) interview. Varied by `seed` so
 * repeat users don't hear the identical script every time.
 */
export function buildOpening({
  userName,
  role,
  questionCount,
  firstQuestion,
  seed = Math.floor(Math.random() * 1000),
}: {
  userName: string;
  role?: string;
  questionCount: number;
  firstQuestion: string;
  seed?: number;
}): string {
  const roleLabel = role?.trim() || "mock";
  const n = Math.max(questionCount, 1);
  const lead = pick(FIRST_QUESTION_LEADS, seed + 3);

  return [
    pick(OPENING_GREETINGS, seed)(userName),
    pick(OPENING_FRAMES, seed + 1)(roleLabel, n),
    pick(OPENING_REASSURANCES, seed + 2),
    `${lead} ${firstQuestion}`.trim(),
  ].join(" ");
}

/**
 * Keep only the first question in an interviewer line. Models like to stack a
 * second ask ("…? And what made it tricky?"), which no human interviewer does
 * and which leaves the candidate unsure what to answer.
 */
export function limitToOneQuestion(line: string): string {
  const first = line.indexOf("?");
  if (first === -1) return line.trim();
  const rest = line.slice(first + 1);
  return rest.includes("?") ? line.slice(0, first + 1).trim() : line.trim();
}

/** Openers that sound like grading or filler rather than listening. */
const SCRIPTED_OPENERS =
  /^(?:that'?s an? (?:great|good|solid|clear|excellent|interesting|fair|thorough|nice|strong)\b|great\b|excellent\b|fantastic\b|absolutely\b|thank you for sharing|thanks for sharing|building on that|interesting\b)/i;

export function hasScriptedOpener(line: string): boolean {
  return SCRIPTED_OPENERS.test(line.trim());
}

/**
 * Drop a scripted first sentence ("That's a solid plan.") when the rest of
 * the line still stands on its own. Free, unlike asking the model again —
 * which matters on Gemini's free tier.
 */
export function stripScriptedOpener(line: string): string {
  const trimmed = line.trim();
  if (!hasScriptedOpener(trimmed)) return trimmed;
  const match = trimmed.match(/^[^.!?]*[.!]\s+/);
  if (!match) return trimmed; // the opener *is* the question — keep it
  const rest = trimmed.slice(match[0].length).trim();
  if (rest.length < 15) return trimmed;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Bridges used when moving to a new topic without a model turn. */
export const TOPIC_TRANSITIONS = [
  "Let's switch gears.",
  "Let me take us somewhere different.",
  "Moving on to another area.",
  "I'd like to shift to something else.",
  "Let's look at a different topic.",
] as const;

export function buildTransition(seed: number): string {
  return pick(TOPIC_TRANSITIONS, seed);
}
