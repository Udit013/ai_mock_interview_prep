import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

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

interface RunAdaptiveTurnArgs {
  role: string;
  level: string;
  type: string; // Technical | Behavioral | Mixed
  seedQuestions: string[];
  conversationHistory: { role: string; content: string }[];
  userAnswer: string;
  currentState: InterviewStateSchema;
  exchangeCount: number; // how many answers the candidate has now given
  maxExchanges: number;
}

/**
 * Run a single adaptive interview turn. Returns the spoken interviewer line,
 * the updated state, and whether the interview is finished. Termination is
 * enforced deterministically via `mustFinish` — never left solely to the model.
 */
export async function runAdaptiveTurn(
  args: RunAdaptiveTurnArgs
): Promise<{ turn: AdaptiveTurn; isFinished: boolean }> {
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
  } = args;

  const mustFinish = exchangeCount >= maxExchanges;

  const historyText = conversationHistory
    .map(
      (m) =>
        `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`
    )
    .join("\n");

  const typeGuidance =
    type.toLowerCase() === "behavioral"
      ? "This is a behavioral interview. Probe for specifics using the STAR structure (Situation, Task, Action, Result) and real examples."
      : type.toLowerCase() === "technical"
      ? "This is a technical interview. Probe depth of understanding, trade-offs, and correctness."
      : "This is a mixed interview. Blend behavioral and technical probing as appropriate.";

  const prompt = `You are an expert, genuinely adaptive interviewer conducting a ${level} ${type} interview for a ${role} position. ${typeGuidance}

You are given a backbone of seed questions to cover, but you adapt based on how the candidate is doing:
- Strong, deep answer -> raise difficulty (action: increase_difficulty) or move on (next_topic).
- Weak or vague answer -> ask a targeted follow-up (action: follow_up).
- Missing fundamentals -> probe the basics (action: probe_basics).
- Incomplete or unclear answer -> ask for clarification (action: clarify).
- When the important topics are covered (or you are told to finish) -> wrap up (action: finish).

Seed questions (the topics to ground the interview):
${seedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Current interview state (your running assessment):
${JSON.stringify(currentState)}

Conversation so far:
${historyText}
Candidate: ${userAnswer}

${
  mustFinish
    ? "IMPORTANT: The interview has reached its length limit. You MUST set action to \"finish\" and give a warm, professional closing (thank them, mention feedback is coming). Do not ask another question."
    : "Decide the best next action, update your assessment of the candidate, and produce what you will say next."
}

Evaluate the candidate's most recent answer, update the interview state (carry forward prior strengths/weaknesses/topics and add new ones; adjust estimatedConfidence and difficulty), choose an action, and write the spoken response. The spoken response is read aloud, so use natural speech with no markdown, no bullet points, and no numbering. Keep it to 2-3 sentences.`;

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: adaptiveTurnSchema,
    prompt,
  });

  // Deterministic termination: the cap wins over the model's choice.
  const isFinished = mustFinish || object.action === "finish";

  return { turn: object, isFinished };
}
