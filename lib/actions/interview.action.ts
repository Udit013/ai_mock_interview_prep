"use server";

import { randomBytes } from "crypto";
import { db } from "@/firebase/admin";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { feedbackSchema } from "@/constants";
import { companyPromptBlock } from "@/constants/companies";
import { getCurrentUser } from "@/lib/actions/auth.action";

export async function getInterviewById(id: string): Promise<Interview | null> {
  try {
    const doc = await db.collection("interviews").doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Interview;
  } catch (e) {
    console.error("getInterviewById error:", e);
    return null;
  }
}

export async function getLatestInterviews({
  userId,
  limit = 20,
}: GetLatestInterviewsParams): Promise<Interview[]> {
  try {
    // Single-field where avoids composite index requirement; filter + sort client-side
    const snapshot = await db
      .collection("interviews")
      .where("finalized", "==", true)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Interview)
      .filter((i) => i.userId !== userId)
      // Privacy: never surface another user's private interviews (e.g. résumé
      // interviews). Older docs have no `visibility` field and stay public.
      .filter((i) => i.visibility !== "private")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  } catch (e) {
    console.error("getLatestInterviews error:", e);
    return [];
  }
}

export async function getInterviewsByUserId(userId: string): Promise<Interview[]> {
  try {
    // Single-field where; sort client-side to avoid needing a composite index
    const snapshot = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Interview)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  } catch (e) {
    console.error("getInterviewsByUserId error:", e);
    return [];
  }
}

export async function getFeedbackByUserId(
  userId: string
): Promise<Feedback[]> {
  try {
    const snapshot = await db
      .collection("feedback")
      .where("userId", "==", userId)
      .get();

    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Feedback
    );
  } catch (e) {
    console.error("getFeedbackByUserId error:", e);
    return [];
  }
}

export async function getFeedbackByInterviewId({
  interviewId,
  userId,
}: GetFeedbackByInterviewIdParams): Promise<Feedback | null> {
  try {
    const snapshot = await db
      .collection("feedback")
      .where("interviewId", "==", interviewId)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Feedback;
  } catch (e) {
    console.error("getFeedbackByInterviewId error:", e);
    return null;
  }
}

/** Enable sharing: mints an unguessable token for the owner's feedback doc. */
export async function shareFeedback(
  feedbackId: string
): Promise<{ success: boolean; shareToken?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false };

    const ref = db.collection("feedback").doc(feedbackId);
    const doc = await ref.get();
    if (!doc.exists || doc.data()?.userId !== user.id) {
      return { success: false };
    }

    const shareToken = randomBytes(16).toString("hex"); // 32 hex chars
    await ref.update({ shareToken });
    return { success: true, shareToken };
  } catch (e) {
    console.error("shareFeedback error:", e);
    return { success: false };
  }
}

/** Revoke sharing: removes the token so the public link stops working. */
export async function unshareFeedback(
  feedbackId: string
): Promise<{ success: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false };

    const ref = db.collection("feedback").doc(feedbackId);
    const doc = await ref.get();
    if (!doc.exists || doc.data()?.userId !== user.id) {
      return { success: false };
    }

    await ref.update({ shareToken: null });
    return { success: true };
  } catch (e) {
    console.error("unshareFeedback error:", e);
    return { success: false };
  }
}

/** Public lookup by share token — returns null for invalid/revoked tokens. */
export async function getFeedbackByShareToken(
  token: string
): Promise<{ feedback: Feedback; interview: Interview | null } | null> {
  try {
    if (!/^[a-f0-9]{32}$/.test(token)) return null;

    const snapshot = await db
      .collection("feedback")
      .where("shareToken", "==", token)
      .limit(1)
      .get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const feedback = { id: doc.id, ...doc.data() } as Feedback;
    const interview = await getInterviewById(feedback.interviewId);
    return { feedback, interview };
  } catch (e) {
    console.error("getFeedbackByShareToken error:", e);
    return null;
  }
}

export async function createFeedback({
  interviewId,
  userId,
  transcript,
  feedbackId,
  speakingAnalytics,
  finalCode,
}: CreateFeedbackParams): Promise<{ success: boolean; feedbackId?: string }> {
  try {
    // Never trust the caller-supplied userId: server actions are public
    // endpoints. The session must exist and match.
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.id !== userId) {
      return { success: false };
    }

    // If overwriting existing feedback, it must belong to this user.
    if (feedbackId) {
      const existing = await db.collection("feedback").doc(feedbackId).get();
      if (existing.exists && existing.data()?.userId !== sessionUser.id) {
        return { success: false };
      }
    }

    // Company mode (if any) shapes the evaluation emphasis.
    const interviewDoc = await db.collection("interviews").doc(interviewId).get();
    const companyBlock = companyPromptBlock(interviewDoc.data()?.companyMode);

    // Cap the persisted transcript so a hostile caller can't bloat documents.
    const storedTranscript = transcript
      .slice(0, 60)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));

    const formattedTranscript = storedTranscript
      .map(({ role, content }) => `- ${role}: ${content}`)
      .join("\n");

    const codeSection = finalCode
      ? `\nThe candidate's final submitted code (${finalCode.language}):\n\`\`\`\n${finalCode.code.slice(0, 20000)}\n\`\`\`\nInclude code quality (correctness, complexity, edge cases, readability) in your evaluation.\n`
      : "";

    const { object: feedbackData } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: feedbackSchema,
      prompt: `You are an expert interview coach analyzing a mock job interview transcript.
${companyBlock}
Transcript:
${formattedTranscript}
${codeSection}
Evaluate the candidate on these 5 dimensions (score each 0-100):
1. Communication Skills — clarity, structure, articulation
2. Technical Knowledge — accuracy and depth of technical answers
3. Problem Solving — approach to breaking down and solving problems
4. Cultural Fit — collaboration, attitude, values alignment
5. Confidence and Clarity — composure, assertiveness, conciseness

Return:
- totalScore: overall weighted score (0-100)
- categoryScores: array of {name, score, comment} for each dimension
- strengths: 3-5 specific things the candidate did well
- areasForImprovement: 3-5 specific things to work on
- finalAssessment: 2-3 sentence overall summary with actionable advice
- starCompleteness: for behavioural answers, whether the candidate covered each
  part of the STAR method (Situation, Task, Action, Result). If the interview
  was purely technical with no behavioural answers, set all four to false and
  say so in the note.

Be specific and constructive. Reference actual moments from the transcript when possible.`,
    });

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    await feedbackRef.set({
      interviewId,
      userId,
      ...feedbackData,
      // Phase 4: persist deterministic speaking metrics alongside the AI feedback.
      ...(speakingAnalytics ? { speakingAnalytics } : {}),
      // Realism: persist the transcript for interview replay.
      transcript: storedTranscript,
      ...(finalCode
        ? {
            finalCode: {
              language: finalCode.language,
              code: finalCode.code.slice(0, 20000),
            },
          }
        : {}),
      createdAt: new Date().toISOString(),
    });

    return { success: true, feedbackId: feedbackRef.id };
  } catch (e) {
    console.error("createFeedback error:", e);
    return { success: false };
  }
}
