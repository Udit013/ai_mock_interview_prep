import { z } from "zod";
import {
  runAdaptiveTurn,
  maxExchangesFor,
  DEFAULT_INTERVIEW_STATE,
  interviewStateInputSchema,
  deliverySignalsSchema,
  codeSubmissionSchema,
} from "@/lib/ai/adaptive";
import { companyPromptBlock } from "@/constants/companies";
import { isNonAnswer, planSkipTurn } from "@/lib/interview/non-answer";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Gemini calls are capped at 45 s (lib/ai/limits.ts); leave headroom for auth
// and Firestore. Must be a literal — Next reads it statically.
export const maxDuration = 60;

// Bounds keep prompt size (and Gemini cost) capped even for hostile payloads.
const respondBodySchema = z.object({
  role: z.string().max(100).optional().default(""),
  level: z.string().max(50).optional().default(""),
  type: z.string().max(50).optional().default("Mixed"),
  questions: z.array(z.string().max(1000)).max(20).optional().default([]),
  userAnswer: z.string().min(1).max(8000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(8000),
      })
    )
    .max(40)
    .optional()
    .default([]),
  interviewState: interviewStateInputSchema.optional(),
  exchangeCount: z.coerce.number().int().min(0).max(50).optional().default(0),
  // Realism: how the answer was delivered (hesitation, pace, fillers).
  deliverySignals: deliverySignalsSchema.optional(),
  // Coding interviews: code the candidate submitted for review.
  codeSubmission: codeSubmissionSchema.optional(),
  // Company template id — styles prompts only, so client-supplied is fine.
  companyMode: z.string().max(30).optional(),
  // Which seed question is currently being discussed, so an unanswered
  // question can be skipped deterministically without asking the model.
  activeQuestionIndex: z.coerce
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .default(0),
});

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(n, lo), hi);

const addUnique = (list: string[], entry: string, cap = 12) =>
  list.includes(entry) ? list : [...list, entry].slice(-cap);

export async function POST(request: Request) {
  try {
    // Auth: this route drives Gemini calls — signed-in users only.
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { allowed } = await checkRateLimit(
      user.id,
      "respond",
      RATE_LIMITS.interviewTurn
    );
    if (!allowed) {
      return Response.json(
        { success: false, error: "Daily interview limit reached." },
        { status: 429 }
      );
    }

    const parsed = respondBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Invalid request." },
        { status: 400 }
      );
    }
    const {
      role,
      level,
      type,
      questions,
      userAnswer,
      conversationHistory,
      interviewState,
      exchangeCount,
      deliverySignals,
      codeSubmission,
      companyMode,
      activeQuestionIndex,
    } = parsed.data;

    const maxExchanges = maxExchangesFor(questions.length);
    // The candidate has just submitted an answer; that one is counted here.
    const answersGiven = exchangeCount + 1;

    // ── Fast path: the candidate said they can't answer ──────────────────────
    // Handled deterministically instead of via the model so the interview moves
    // on instantly, never re-asks, and never makes them wait on a round trip.
    // Skipped when code was submitted — there the code itself is the answer.
    if (!codeSubmission && isNonAnswer(userAnswer)) {
      const plan = planSkipTurn({
        questions,
        currentIndex: activeQuestionIndex,
        answersGiven,
        maxExchanges,
      });

      const state = interviewState ?? DEFAULT_INTERVIEW_STATE;

      return Response.json({
        success: true,
        aiResponse: plan.aiResponse,
        interviewState: {
          ...state,
          weaknesses: addUnique(
            state.weaknesses,
            `Could not answer: ${plan.skippedTopic}`
          ),
          topicsCovered: addUnique(state.topicsCovered, plan.skippedTopic),
          // An unanswered question is evidence, but one blank shouldn't tank
          // the running estimate — nudge it down rather than collapse it.
          estimatedConfidence: clamp(state.estimatedConfidence - 8, 0, 100),
        },
        action: plan.action,
        activeQuestionIndex: plan.activeQuestionIndex,
        exchangeCount: answersGiven,
        isFinished: plan.isFinished,
        skipped: true,
      });
    }

    const { turn, isFinished } = await runAdaptiveTurn({
      role: role || "the role",
      level: level || "the",
      type: type || "Mixed",
      seedQuestions: questions,
      conversationHistory,
      userAnswer,
      currentState: interviewState ?? DEFAULT_INTERVIEW_STATE,
      exchangeCount: answersGiven,
      maxExchanges,
      deliverySignals,
      codeSubmission,
      companyBlock: companyPromptBlock(companyMode),
    });

    return Response.json({
      success: true,
      aiResponse: turn.spokenResponse.trim(),
      interviewState: turn.updatedState,
      action: turn.action,
      activeQuestionIndex: turn.activeQuestionIndex,
      exchangeCount: answersGiven,
      isFinished,
    });
  } catch (error) {
    console.error("Interview respond error:", error);
    return Response.json(
      { success: false, error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
