/**
 * Fetch-and-compute wrapper for callers that don't already hold the feedback.
 * Not `"use server"` — see the note in `lib/data/interview.data.ts`.
 *
 * The aggregation itself lives in `lib/analytics/progress.ts` so it stays pure
 * and testable without Firebase credentials.
 */

import { computeProgress } from "@/lib/analytics/progress";
import { getFeedbackByUserId } from "@/lib/data/interview.data";

export async function getUserProgress(userId: string): Promise<UserProgress> {
  if (!userId) return computeProgress([]);
  return computeProgress(await getFeedbackByUserId(userId));
}
