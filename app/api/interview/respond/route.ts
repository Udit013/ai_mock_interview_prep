import {
  runAdaptiveTurn,
  maxExchangesFor,
  DEFAULT_INTERVIEW_STATE,
  type InterviewStateSchema,
} from "@/lib/ai/adaptive";

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  role: string;
  level: string;
  type: string;
  questions: string[];
  userAnswer: string;
  conversationHistory: ConversationMessage[];
  // Adaptive engine state (optional for backwards compatibility).
  interviewState?: InterviewStateSchema;
  exchangeCount?: number;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const {
      role,
      level,
      type,
      questions,
      userAnswer,
      conversationHistory,
      interviewState,
      exchangeCount,
    } = body;

    const seedQuestions = questions ?? [];
    const maxExchanges = maxExchangesFor(seedQuestions.length);
    // The candidate has just submitted an answer; that one is counted here.
    const answersGiven = (exchangeCount ?? 0) + 1;

    const { turn, isFinished } = await runAdaptiveTurn({
      role: role || "the role",
      level: level || "the",
      type: type || "Mixed",
      seedQuestions,
      conversationHistory: conversationHistory ?? [],
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
