import { db } from "@/firebase/admin";

/**
 * Minimal Firestore-backed daily rate limiter (no external services).
 *
 * One document per user/action/day, incremented in a transaction so
 * concurrent requests can't slip past the cap. Serverless-safe: state lives
 * in Firestore, not in-process memory.
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  dailyLimit: number
): Promise<{ allowed: boolean; remaining: number }> {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const ref = db.collection("rateLimits").doc(`${userId}_${action}_${day}`);

  try {
    const remaining = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;

      if (count >= dailyLimit) return -1;

      tx.set(
        ref,
        { userId, action, day, count: count + 1 },
        { merge: true }
      );
      return dailyLimit - (count + 1);
    });

    return { allowed: remaining >= 0, remaining: Math.max(remaining, 0) };
  } catch (e) {
    // Fail open: a limiter outage should not take the product down.
    console.error("checkRateLimit error:", e);
    return { allowed: true, remaining: dailyLimit };
  }
}

/** Daily per-user caps for Gemini-backed endpoints. */
export const RATE_LIMITS = {
  generateInterview: 20,
  interviewTurn: 300,
  resumeParse: 10,
} as const;
