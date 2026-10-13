import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { aiAbortSignal } from "@/lib/ai/limits";
import { z } from "zod";
import {
  askedQuestions,
  extractQuestions,
  isNearDuplicate,
  limitToOneQuestion,
  recentOpeners,
  stripScriptedOpener,
} from "@/lib/interview/conversation";

/** Live model of how the interview is going, carried across turns. */
export const interviewStateSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  topicsCovered: z.array(z.string()),
  estimatedConfidence: z.number().min(0).max(100),
  difficulty: z.enum(["easy", "medium", "hard"]),
  followUpOpportunities: z.array(z.string()),
});

export type InterviewStateSchema = z.infer<typeof interviewStateSchema>;

/** Most recent entries kept per state list; older ones add little signal. */
export const STATE_LIST_MAX = 20;
/** Longest single state entry, in characters. */
export const STATE_ITEM_MAX_CHARS = 300;

/**
 * Trim the state to a fixed size. The state round-trips through the browser
 * and is pasted into every prompt, so without this a client (or a verbose
 * model) could grow each Gemini call without limit.
 */
export function boundInterviewState<T extends InterviewStateSchema>(
  state: T
): T {
  const trimList = (list: string[]) =>
    list.slice(-STATE_LIST_MAX).map((s) => s.slice(0, STATE_ITEM_MAX_CHARS));
  return {
    ...state,
    strengths: trimList(state.strengths),
    weaknesses: trimList(state.weaknesses),
    topicsCovered: trimList(state.topicsCovered),
    followUpOpportunities: trimList(state.followUpOpportunities),
  };
}

/**
 * Request-side variant: rejects absurd payloads outright, then trims anything
 * merely oversized so a long interview never fails validation mid-session.
 */
const inputList = z.array(z.string().max(5000)).max(200);
export const interviewStateInputSchema = interviewStateSchema
  .extend({
    strengths: inputList,
    weaknesses: inputList,
    topicsCovered: inputList,
    followUpOpportunities: inputList,
    // Server-maintained: consecutive turns spent on the current seed question.
    topicTurns: z.number().int().min(0).max(50).optional(),
  })
  .transform(boundInterviewState);

/** One adaptive turn: evaluate the answer, update state, decide + speak next. */
export const adaptiveTurnSchema = z.object({
  evaluation: z.object({
    depth: z.enum(["shallow", "adequate", "strong"]),
    note: z.string().describe("One sentence on the quality of the last answer."),
  }),
  action: z.enum([
    "follow_up",
    "increase_difficulty",
    "probe_basics",
    "clarify",
    "next_topic",
    "finish",
  ]),
  updatedState: interviewStateSchema,
  activeQuestionIndex: z
    .number()
    .int()
    .min(0)
    .describe(
      "0-based index of the seed question currently being discussed, so the UI can highlight it."
    ),
  spokenResponse: z
    .string()
    .describe(
      "What the interviewer says next, read aloud by a voice assistant: a brief acknowledgement plus the next question (or the closing). No markdown, no lists, 2-3 sentences."
    ),
});

export type AdaptiveTurn = z.infer<typeof adaptiveTurnSchema>;

export const DEFAULT_INTERVIEW_STATE: InterviewStateSchema = {
  strengths: [],
  weaknesses: [],
  topicsCovered: [],
  estimatedConfidence: 50,
  difficulty: "medium",
  followUpOpportunities: [],
};

/**
 * Hard cap on candidate answers so the interview always terminates, regardless
 * of what the model decides. Seed questions form the backbone; we allow a few
 * adaptive follow-ups on top, capped at 12 total.
 */
export function maxExchangesFor(seedQuestionCount: number): number {
  return Math.min(Math.max(seedQuestionCount, 1) + 4, 12);
}

/**
 * How the candidate *delivered* their last answer — measured in the browser,
 * so the interviewer can react to hesitation and confidence like a human.
 */
export const deliverySignalsSchema = z.object({
  hesitationSeconds: z.number().min(0).max(120),
  answerSeconds: z.number().min(0).max(600),
  wordCount: z.number().int().min(0).max(5000),
  fillerCount: z.number().int().min(0).max(500),
});

export type DeliverySignals = z.infer<typeof deliverySignalsSchema>;

/** Code the candidate submitted for review during a coding interview. */
export const codeSubmissionSchema = z.object({
  language: z.enum(["javascript", "python", "java", "cpp"]),
  code: z.string().max(20_000),
});

export type CodeSubmission = z.infer<typeof codeSubmissionSchema>;

function describeDelivery(signals: DeliverySignals): string {
  const notes: string[] = [];

  if (signals.hesitationSeconds >= 8) {
    notes.push(
      `paused ${Math.round(signals.hesitationSeconds)}s before answering (long hesitation)`
    );
  } else if (signals.hesitationSeconds <= 2) {
    notes.push("answered promptly");
  }

  const wpm =
    signals.answerSeconds > 0
      ? Math.round((signals.wordCount / signals.answerSeconds) * 60)
      : 0;
  if (wpm > 0) notes.push(`spoke at ~${wpm} words/min`);

  if (signals.wordCount > 0) {
    const fillerRate = signals.fillerCount / signals.wordCount;
    if (fillerRate > 0.12) notes.push("heavy filler-word use (sounds unsure)");
    else if (signals.fillerCount === 0) notes.push("no filler words (composed)");
  }

  if (signals.wordCount < 15 && signals.answerSeconds < 8) {
    notes.push("very short answer");
  }

  return notes.join("; ");
}

interface RunAdaptiveTurnArgs {
  role: string;
  level: string;
  type: string; // Technical | Behavioral | Mixed | System Design | Coding
  seedQuestions: string[];
  conversationHistory: { role: string; content: string }[];
  userAnswer: string;
  currentState: InterviewStateSchema;
  exchangeCount: number; // how many answers the candidate has now given
  maxExchanges: number;
  deliverySignals?: DeliverySignals;
  codeSubmission?: CodeSubmission;
  companyBlock?: string;
  /** Seed question being discussed before this turn. */
  activeQuestionIndex?: number;
  /** Turns already spent on that seed question (follow-ups included). */
  topicTurns?: number;
}

/** Follow-ups allowed on one seed question before moving on. */
export const MAX_TURNS_PER_TOPIC = 3;

/** Phrases that make an interviewer sound scripted. */
const BANNED_PHRASES = [
  "Great answer",
  "Great question",
  "That's a great point",
  "Excellent",
  "Absolutely",
  "Thank you for sharing",
  "Building on that",
  "Let's dive",
  "dive deeper",
  "delve",
  "Fantastic",
  "Interesting!",
  "That's a solid",
  "That's a clear",
  "That's a good",
  "Could you elaborate",
];

/**
 * Run a single adaptive interview turn. Returns the spoken interviewer line,
 * the updated state, and whether the interview is finished. Termination is
 * enforced deterministically via `mustFinish` — never left solely to the model.
 */
export async function runAdaptiveTurn(
  args: RunAdaptiveTurnArgs
): Promise<{ turn: AdaptiveTurn; isFinished: boolean; topicTurns: number }> {
  const {
    role,
    level,
    type,
    seedQuestions,
    conversationHistory,
    userAnswer,
    currentState,
    exchangeCount,
    maxExchanges,
    deliverySignals,
    codeSubmission,
    companyBlock,
    activeQuestionIndex = 0,
    topicTurns = 0,
  } = args;

  const mustFinish = exchangeCount >= maxExchanges;
  const lastSeed = Math.max(seedQuestions.length - 1, 0);
  const currentIndex = Math.min(Math.max(activeQuestionIndex, 0), lastSeed);
  // Deterministic cap: after this many turns on one topic, the model is told
  // it must move on, so no question gets drilled into the ground.
  const mustMoveOn = topicTurns + 1 >= MAX_TURNS_PER_TOPIC;
  const remainingSeeds = seedQuestions
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => i > currentIndex);
  const alreadyAsked = askedQuestions(conversationHistory);
  const openersToAvoid = recentOpeners(conversationHistory);
  // The very first word matters too: "Okay…" twice in a row sounds canned.
  const lastFirstWord = recentOpeners(conversationHistory, 1, 1)[0]?.replace(
    /[^A-Za-z']/g,
    ""
  );

  const historyText = conversationHistory
    .map(
      (m) =>
        `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`
    )
    .join("\n");

  const t = type.toLowerCase();
  const typeGuidance =
    t === "behavioral"
      ? "This is a behavioral interview. Probe for specifics using the STAR structure (Situation, Task, Action, Result) and real examples."
      : t === "technical"
      ? "This is a technical interview. Probe depth of understanding, trade-offs, and correctness."
      : t === "system design"
      ? "This is a system design interview. Expect the candidate to clarify requirements before designing, estimate scale (users, QPS, storage), reason about trade-offs (consistency vs availability, SQL vs NoSQL, caching), identify bottlenecks, and evolve the design as you add constraints. Push on whatever they gloss over."
      : t === "coding"
      ? "This is a coding interview. The candidate is writing code in an editor while talking. IMPORTANT: the full problem statement is displayed on their screen, so NEVER read a problem aloud — refer to it in a few words instead (e.g. \"the two-sum problem\") and move straight to discussion. Evaluate their approach, correctness, complexity analysis, and edge-case thinking. When they submit code, review it like a human interviewer: point at specific lines conversationally, probe bugs and complexity, and ask how they would test it."
      : "This is a mixed interview. Blend behavioral and technical probing as appropriate.";

  const deliveryNote = deliverySignals ? describeDelivery(deliverySignals) : "";

  const codeBlock = codeSubmission
    ? `\nThe candidate just submitted this ${codeSubmission.language} code for review:\n\`\`\`${codeSubmission.language}\n${codeSubmission.code}\n\`\`\`\n`
    : "";

  const prompt = `You are an experienced ${role} interviewer running a live ${level}-level ${type} interview over voice. You have interviewed hundreds of candidates: you are warm but rigorous, curious about how they think, and you talk like a person, not a script. ${typeGuidance}
${companyBlock ?? ""}${
    deliveryNote
      ? `\nDelivery observation for the candidate's last answer: ${deliveryNote}.
React to delivery like a considerate human would: if they hesitated a long time or sound unsure, briefly put them at ease before probing; if they were composed and quick, you can push harder. Fold delivery into estimatedConfidence. Never recite these metrics.\n`
      : ""
  }${codeBlock}

HOW TO RUN THE CONVERSATION
- Listen first. React to something SPECIFIC the candidate just said — a choice they made, a term they used, a gap you noticed — in a few words. Don't grade the answer out loud ("That's a solid plan", "That's a clear explanation"): real interviewers keep their verdict to themselves and respond to the content ("Okay, so the second write clobbered the first.", "Right — the lock is held until commit.").
- Ask exactly ONE question, in ONE sentence, ending with a single question mark. Don't join two asks with "and" ("…tell me about X, and what Y?" is two questions — pick the more revealing one), and don't add a second question afterwards.
- Follow-ups must come from their answer: pick the most interesting or weakest point ("You said you'd add an index on email — what happens to write performance?"). Don't ask a generic follow-up that could apply to anyone.
- Adapt depth: a strong, specific answer earns a harder angle or a move to the next topic; a vague answer earns a pointed follow-up asking for a concrete example, number, or trade-off; missing fundamentals earn one simpler probing question.
- When you change topic, bridge naturally in a short phrase so it doesn't feel abrupt, and put the next seed question in your own conversational words — don't read it verbatim if it sounds stiff, but keep its substance.
- Never re-ask or lightly reword a question that has already been asked (list below).
- If the candidate says they can't answer ("I don't know", "no idea", "skip"), don't push: acknowledge it in a kind, low-key way and move to the next uncovered seed question (action: next_topic).
- Vary your phrasing. Do NOT start your response with any of these recent openings: ${
    openersToAvoid.length ? openersToAvoid.map((o) => `"${o}…"`).join(", ") : "(none yet)"
  }${
    lastFirstWord ? `, and don't begin with the word "${lastFirstWord}" again` : ""
  }. Avoid stock phrases such as ${BANNED_PHRASES.map((p) => `"${p}"`).join(", ")}.
- Spoken style: contractions, plain words, 2-3 short sentences, under about 60 words. No markdown, lists, or numbering — it is read aloud.

INTERVIEW PLAN
Seed questions (the backbone to cover, in order):
${seedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

You are currently on seed question ${currentIndex + 1} of ${seedQuestions.length} and have spent ${topicTurns + 1} turn(s) on it.
${
  mustMoveOn && remainingSeeds.length > 0
    ? `You have explored this topic enough. You MUST now move to seed question ${remainingSeeds[0].i + 1} (action: next_topic) and set activeQuestionIndex to ${remainingSeeds[0].i}.`
    : remainingSeeds.length > 0
    ? `Remaining seed questions: ${remainingSeeds.map(({ i }) => i + 1).join(", ")}. Set activeQuestionIndex to the 0-based index of the seed question you are asking about.`
    : `This is the last seed question. Once it is reasonably covered, wrap up (action: finish).`
}

Questions already asked (never repeat these, even reworded):
${alreadyAsked.length ? alreadyAsked.map((q) => `- ${q}`).join("\n") : "- (none)"}

Current running assessment:
${JSON.stringify(currentState)}

Conversation so far:
${historyText}
Candidate: ${userAnswer}

${
  mustFinish
    ? "IMPORTANT: The interview has reached its length limit. Set action to \"finish\" and close the way a real interviewer would: a brief, genuine remark about the conversation, thanks, and that feedback is on its way. Do not ask another question."
    : "Decide the best next action, update your assessment, and write what you say next."
}

Update the interview state (carry forward prior strengths, weaknesses, and topics; add new ones; adjust estimatedConfidence and difficulty), choose an action, set activeQuestionIndex, and write spokenResponse.`;

  const generate = (extra = "") =>
    generateObject({
      model: google("gemini-2.5-flash"),
      abortSignal: aiAbortSignal(),
      schema: adaptiveTurnSchema,
      prompt: prompt + extra,
    }).then((r) => r.object);

  let object = await generate();

  // Repetition guard: one retry when the draft re-asks an earlier question.
  // Rare, and the only fix that needs the model — so it's the only one that
  // spends extra quota (the free tier allows ~20 requests/day).
  const repeated = extractQuestions(object.spokenResponse).find((q) =>
    isNearDuplicate(q, alreadyAsked)
  );
  if (repeated && !mustFinish) {
    object = await generate(
      `\n\nYour previous draft asked "${repeated}", which repeats an earlier question. Ask something genuinely new instead.`
    );
  }

  // Free, deterministic polish: no graded opener, one question at a time.
  object = {
    ...object,
    spokenResponse: limitToOneQuestion(stripScriptedOpener(object.spokenResponse)),
  };

  // Deterministic termination: the cap wins over the model's choice.
  const isFinished = mustFinish || object.action === "finish";

  // The question index only moves forward and stays in range, whatever the
  // model returns, so progress can't loop back to an earlier topic.
  const nextIndex = Math.min(
    Math.max(object.activeQuestionIndex, currentIndex),
    lastSeed
  );

  return {
    turn: {
      ...object,
      activeQuestionIndex: nextIndex,
      updatedState: boundInterviewState(object.updatedState),
    },
    isFinished,
    topicTurns: nextIndex === currentIndex ? topicTurns + 1 : 0,
  };
}
