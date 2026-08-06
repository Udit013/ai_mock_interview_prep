/**
 * Read-only interview/feedback data access.
 *
 * SECURITY: this module is deliberately NOT marked `"use server"`. Every export
 * of a `"use server"` module becomes a publicly callable RPC endpoint, so a
 * reader that takes a caller-supplied `userId` would let anyone fetch anyone
 * else's transcripts. These functions are plain server-side helpers: they can
 * only be called from server components, route handlers, and server actions —
 * all of which have already established who the caller is.
 *
 * Importing this file from a client component is a build error (firebase-admin
 * is server-only), which is the enforcement mechanism.
 */

import { db } from "@/firebase/admin";

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

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[]> {
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

/** Public lookup by share token — returns null for invalid/revoked tokens. */
export async function getFeedbackByShareToken(
  token: string
): Promise<{ feedback: Feedback; interview: Interview | null } | null> {
  try {
    // Reject malformed tokens before touching Firestore.
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
