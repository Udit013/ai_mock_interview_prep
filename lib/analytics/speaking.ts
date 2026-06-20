/**
 * Deterministic speaking analytics computed entirely in the browser from the
 * interview transcript and per-answer durations. No external speech APIs.
 */

const FILLER_WORDS = [
  "um",
  "uh",
  "er",
  "ah",
  "like",
  "you know",
  "i mean",
  "basically",
  "actually",
  "literally",
  "kind of",
  "kinda",
  "sort of",
  "so",
  "well",
  "right",
];

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Count filler words/phrases across the candidate's spoken text. */
export function countFillerWords(
  text: string
): { total: number; used: { word: string; count: number }[] } {
  const lower = ` ${text.toLowerCase()} `;
  const used: { word: string; count: number }[] = [];
  let total = 0;

  for (const filler of FILLER_WORDS) {
    // Word-boundary match so "so" doesn't match "also", "like" not "unlike".
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "g");
    const matches = lower.match(re);
    if (matches && matches.length > 0) {
      total += matches.length;
      used.push({ word: filler, count: matches.length });
    }
  }

  used.sort((a, b) => b.count - a.count);
  return { total, used };
}

export function computeWpm(words: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.round((words / durationSeconds) * 60);
}

/** Human-readable coaching insights derived from the raw metrics. */
export function buildSpeakingInsights(a: {
  fillerWordCount: number;
  wordsPerMinute: number;
  totalWords: number;
  durationSeconds: number;
}): string[] {
  const insights: string[] = [];

  if (a.durationSeconds === 0 || a.totalWords === 0) {
    return ["Not enough spoken data was captured to analyse your delivery."];
  }

  if (a.fillerWordCount === 0) {
    insights.push("Excellent — you used no detectable filler words.");
  } else if (a.fillerWordCount <= 5) {
    insights.push(
      `You used filler words ${a.fillerWordCount} times — clean delivery.`
    );
  } else {
    insights.push(
      `You used filler words ${a.fillerWordCount} times. Pausing silently instead of saying "um" or "like" will sound more confident.`
    );
  }

  if (a.wordsPerMinute > 180) {
    insights.push(
      `You spoke quickly (${a.wordsPerMinute} wpm). Slowing down a little improves clarity.`
    );
  } else if (a.wordsPerMinute < 110) {
    insights.push(
      `You spoke slowly (${a.wordsPerMinute} wpm). A slightly faster pace can sound more energetic.`
    );
  } else {
    insights.push(
      `Your speaking pace (${a.wordsPerMinute} wpm) was in the ideal range.`
    );
  }

  return insights;
}

/**
 * Compute the full analytics object from the candidate's spoken turns and the
 * measured duration (seconds) of each answer.
 */
export function analyzeSpeaking(
  candidateTurns: string[],
  answerDurationsSeconds: number[]
): SpeakingAnalytics {
  const joined = candidateTurns.join(" ");
  const totalWords = wordCount(joined);
  const durationSeconds = Math.round(
    answerDurationsSeconds.reduce((sum, d) => sum + d, 0)
  );
  const { total: fillerWordCount, used: fillerWordsUsed } =
    countFillerWords(joined);
  const wordsPerMinute = computeWpm(totalWords, durationSeconds);

  return {
    fillerWordCount,
    fillerWordsUsed,
    totalWords,
    durationSeconds,
    wordsPerMinute,
    insights: buildSpeakingInsights({
      fillerWordCount,
      wordsPerMinute,
      totalWords,
      durationSeconds,
    }),
  };
}
