/**
 * Detects when a candidate has clearly signalled they cannot answer, so the
 * interview can move on instead of re-asking or waiting.
 *
 * The hard part is avoiding false positives. "I don't know the exact number,
 * but I'd estimate ~50ms" *starts* like a non-answer and is a good answer. The
 * detector therefore requires all three of:
 *
 *   1. the utterance is short (a real attempt is longer),
 *   2. it contains no continuation marker ("but", "I think", "maybe", …),
 *   3. its core — after leading filler words — matches a refusal pattern.
 *
 * Pure and dependency-free so it can be unit-tested and used on both the client
 * (instant UI feedback) and the server (authoritative decision).
 */

/** Above this many words, treat it as a genuine attempt regardless of wording. */
const MAX_WORDS = 12;

/**
 * Contractions are expanded before matching. Speech recognition emits both
 * "don't" and "dont", and stripping apostrophes naively turns "don't" into
 * "don t" — expanding first makes every pattern below apostrophe-agnostic.
 */
const CONTRACTIONS: [RegExp, string][] = [
  // Irregulars first: a generic "n't" rule would turn "can't" into "ca not".
  [/\bcan'?t\b/g, "cannot"],
  [/\bwon'?t\b/g, "will not"],
  [/\bshan'?t\b/g, "shall not"],
  // Generic apostrophe form. No leading \b — "n't" sits mid-word in "don't".
  [/n't\b/g, " not"],
  // Apostrophe-less forms, which speech recognition also produces.
  [/\bdont\b/g, "do not"],
  [/\bdoesnt\b/g, "does not"],
  [/\bdidnt\b/g, "did not"],
  [/\bisnt\b/g, "is not"],
  [/\bwasnt\b/g, "was not"],
  [/\bhavent\b/g, "have not"],
  [/\bhasnt\b/g, "has not"],
  [/\bhadnt\b/g, "had not"],
  [/\bcouldnt\b/g, "could not"],
  [/\bwouldnt\b/g, "would not"],
  [/\bshouldnt\b/g, "should not"],
  [/\bcant\b/g, "cannot"],
  [/\bwont\b/g, "will not"],
  [/\bi'?m\b/g, "i am"],
  [/\bi'?ve\b/g, "i have"],
  [/\bi'?d\b/g, "i would"],
  [/\bi'?ll\b/g, "i will"],
  [/\blet'?s\b/g, "let us"],
  [/\bthat'?s\b/g, "that is"],
  [/\bit'?s\b/g, "it is"],
  [/\bthere'?s\b/g, "there is"],
];

/**
 * Phrases implying the candidate kept going and actually attempted an answer.
 * "I'm not sure, but I think it's O(n log n)" must never be skipped.
 */
const CONTINUATION_MARKERS = [
  "but",
  "however",
  "though",
  "although",
  "except",
  "i think",
  "i believe",
  "i would guess",
  "my guess",
  "maybe",
  "perhaps",
  "possibly",
  "i would say",
  "probably",
  "it might",
  "it could",
  "it would",
  "presumably",
  "assuming",
  "roughly",
  "approximately",
];

/** Hedges and hesitation sounds that can precede the real content. */
const LEADING_FILLER =
  /^(?:(?:um+|uh+|er+|ah+|hm+|mm+|well|so|like|okay|ok|alright|sorry|honestly|truthfully|yeah|yep|yes|right|oh|hey)\b[\s,._-]*)+/;

/** Utterances whose core means "I cannot answer this". */
const REFUSAL_PATTERNS: RegExp[] = [
  // "I don't know" → "i do not know"
  /^(?:i )?(?:really |honestly |just )?do not know\b/,
  /^(?:i )?do not (?:have|got) (?:an? )?(?:answer|idea|clue)\b/,
  /^(?:i )?do not (?:recall|remember)\b/,
  // "I'm not sure" → "i am not sure"
  /^(?:i am )?not (?:really |entirely |totally |too |completely |quite )?(?:sure|certain)\b/,
  /^(?:i am )?unsure\b/,
  // "no idea" / "I have no clue"
  /^(?:i )?(?:have |got )?no (?:idea|clue)\b/,
  /^(?:i )?(?:cannot|can not|could not) (?:answer|say|recall|remember|think of)\b/,
  // Blanking / giving up
  /^(?:i am )?(?:drawing a blank|blanking)\b/,
  /^(?:i )?(?:give up|pass on this)\b/,
  /^(?:that is|this is) (?:beyond|outside) (?:me|my)\b/,
  // Explicit skip requests
  /^(?:let us )?(?:move on|skip(?: (?:this|it|that|the question))?|next(?: question)?)\b/,
  /^(?:i would like to )?(?:pass|skip)\b/,
  // Bare colloquialisms
  /^dunno\b/,
  /^no comment\b/,
  /^beats me\b/,
  /^(?:i )?(?:have )?never (?:heard of|come across)\b/,
];

/** Normalize for matching: lowercase, expand contractions, strip punctuation. */
function normalize(raw: string): string {
  let text = raw.toLowerCase().replace(/[’‘]/g, "'");
  for (const [pattern, replacement] of CONTRACTIONS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .replace(/'/g, "") // any remaining possessives
    .replace(/[.,!?;:"“”`()[\]…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Repeatedly strip leading hedges so "um, well, I don't know" still matches. */
function stripLeadingFiller(text: string): string {
  let out = text;
  for (let i = 0; i < 5; i++) {
    const next = out.replace(LEADING_FILLER, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

/** True when the candidate has effectively declined to answer. */
export function isNonAnswer(raw: string): boolean {
  if (!raw || !raw.trim()) return true; // silence is a non-answer

  const text = normalize(raw);
  if (!text) return true;

  // Long utterances are genuine attempts even if they contain a hedge.
  if (text.split(" ").length > MAX_WORDS) return false;

  // If they hedged and then continued, they attempted an answer.
  if (CONTINUATION_MARKERS.some((m) => text.includes(m))) return false;

  const core = stripLeadingFiller(text);
  // Nothing but filler ("um, uh") is also a non-answer.
  if (!core) return true;

  return REFUSAL_PATTERNS.some((p) => p.test(core));
}

/** Varied acknowledgements so a skipped question never sounds robotic. */
const SKIP_ACKNOWLEDGEMENTS = [
  "No problem at all — that's a tough one.",
  "That's completely fine, it happens.",
  "No worries, let's keep moving.",
  "That's alright — not everyone has covered that.",
  "Understood, no problem.",
];

/**
 * Build the interviewer's spoken line when skipping an unanswered question.
 * Deterministic given `seed`, so it can be asserted in tests.
 */
export function buildSkipResponse(
  nextQuestion: string | null,
  seed = Math.floor(Math.random() * SKIP_ACKNOWLEDGEMENTS.length)
): string {
  const len = SKIP_ACKNOWLEDGEMENTS.length;
  const ack = SKIP_ACKNOWLEDGEMENTS[((seed % len) + len) % len];

  if (!nextQuestion) {
    return `${ack} That was the last thing I wanted to cover, so let's wrap up there. Thanks for your time — I'll put your feedback together now.`;
  }
  return `${ack} Let's move on. ${nextQuestion}`;
}

export interface SkipTurnPlan {
  aiResponse: string;
  activeQuestionIndex: number;
  isFinished: boolean;
  action: "next_topic" | "finish";
  /** The question the candidate declined, for the running assessment. */
  skippedTopic: string;
}

/**
 * Decide what happens after an unanswered question. Pure so interview
 * progression is directly testable: advance to the next question, or finish
 * when the list is exhausted or the exchange cap is reached.
 */
export function planSkipTurn({
  questions,
  currentIndex,
  answersGiven,
  maxExchanges,
  seed,
}: {
  questions: string[];
  currentIndex: number;
  answersGiven: number;
  maxExchanges: number;
  seed?: number;
}): SkipTurnPlan {
  const lastIndex = Math.max(questions.length - 1, 0);
  const safeIndex = Math.min(Math.max(currentIndex, 0), lastIndex);
  const nextIndex = safeIndex + 1;

  const hasNextQuestion = nextIndex < questions.length;
  const isFinished = !hasNextQuestion || answersGiven >= maxExchanges;

  return {
    aiResponse: buildSkipResponse(
      isFinished ? null : questions[nextIndex],
      seed
    ),
    activeQuestionIndex: isFinished ? safeIndex : nextIndex,
    isFinished,
    action: isFinished ? "finish" : "next_topic",
    skippedTopic: questions[safeIndex]?.slice(0, 90) ?? "a question",
  };
}
