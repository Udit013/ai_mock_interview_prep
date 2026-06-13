import { generateText } from "ai";
import { google } from "@ai-sdk/google";

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  role: string;
  level: string;
  type: string;
  questions: string[];
  currentQuestionIndex: number;
  userAnswer: string;
  conversationHistory: ConversationMessage[];
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const {
      role,
      level,
      type,
      questions,
      currentQuestionIndex,
      userAnswer,
      conversationHistory,
    } = body;

    const totalQuestions = questions.length;
    const isLastQuestion = currentQuestionIndex >= totalQuestions - 1;
    const nextIndex = currentQuestionIndex + 1;

    const historyText = conversationHistory
      .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
      .join("\n");

    let prompt: string;

    if (isLastQuestion) {
      prompt = `You are a professional interviewer conducting a ${level} ${type} interview for a ${role} position.

Conversation so far:
${historyText}
Candidate: ${userAnswer}

This was the final question. Acknowledge their answer briefly (1-2 sentences), then give a warm, professional closing — thank them for their time and let them know feedback will be provided shortly. Keep it natural and concise (3-4 sentences total). Do not use markdown or bullet points.`;
    } else {
      const nextQuestion = questions[nextIndex];
      prompt = `You are a professional interviewer conducting a ${level} ${type} interview for a ${role} position.

Conversation so far:
${historyText}
Candidate: ${userAnswer}

Acknowledge their answer briefly (1 sentence), then smoothly transition to the next question. Ask this exact question: "${nextQuestion}"

Keep it natural and conversational. Do not use markdown, bullet points, or numbering. Total response should be 2-3 sentences.`;
    }

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001"),
      prompt,
    });

    return Response.json({
      success: true,
      aiResponse: text.trim(),
      nextQuestionIndex: nextIndex,
      isFinished: isLastQuestion,
    });
  } catch (error) {
    console.error("Interview respond error:", error);
    return Response.json(
      { success: false, error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
