import { z } from "zod";
import {
  runAdaptiveTurn,
  maxExchangesFor,
  DEFAULT_INTERVIEW_STATE,
  interviewStateSchema,
} from "@/lib/ai/adaptive";
import { getCurrentUser } from "@/lib/actions/auth.action";

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
  interviewState: interviewStateSchema.optional(),
  exchangeCount: z.coerce.number().int().min(0).max(50).optional().default(0),
});

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
    } = parsed.data;

    const maxExchanges = maxExchangesFor(questions.length);
    // The candidate has just submitted an answer; that one is counted here.
    const answersGiven = exchangeCount + 1;

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
    });

    return Response.json({
      success: true,
      aiResponse: turn.spokenResponse.trim(),
      interviewState: turn.updatedState,
      action: turn.action,
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
