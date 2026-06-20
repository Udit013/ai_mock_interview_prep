"use server";

import dayjs from "dayjs";
import { getFeedbackByUserId } from "@/lib/actions/interview.action";

const EMPTY_PROGRESS: UserProgress = {
  totalInterviews: 0,
  averageScore: 0,
  currentStreak: 0,
  scoreTrend: [],
  competencies: [],
  strongest: null,
  weakest: null,
  recentImprovement: null,
};

/** Count consecutive days (ending today or yesterday) that have activity. */
function computeStreak(isoDates: string[]): number {
  if (isoDates.length === 0) return 0;

  const days = Array.from(
    new Set(isoDates.map((d) => dayjs(d).format("YYYY-MM-DD")))
  ).sort((a, b) => (a < b ? 1 : -1)); // most recent first

  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  // Streak only counts if the latest activity was today or yesterday.
  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const expectedPrev = dayjs(days[i - 1])
      .subtract(1, "day")
      .format("YYYY-MM-DD");
    if (days[i] === expectedPrev) streak++;
    else break;
  }
  return streak;
}

const avg = (nums: number[]) =>
  nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;

/**
 * Aggregate a user's feedback history into a progress summary for the
 * coaching-hub dashboard. All computation is in-app over existing feedback docs.
 */
export async function getUserProgress(userId: string): Promise<UserProgress> {
  if (!userId) return EMPTY_PROGRESS;

  const feedbacks = (await getFeedbackByUserId(userId))
    .filter((f) => typeof f.totalScore === "number")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const total = feedbacks.length;
  if (total === 0) return EMPTY_PROGRESS;

  const scoreTrend: ScorePoint[] = feedbacks.map((f) => ({
    date: f.createdAt,
    score: f.totalScore,
  }));

  const averageScore = Math.round(avg(feedbacks.map((f) => f.totalScore)));

  // Average each competency (category) across all interviews.
  const catMap: Record<string, number[]> = {};
  for (const f of feedbacks) {
    for (const c of f.categoryScores ?? []) {
      (catMap[c.name] ??= []).push(c.score);
    }
  }
  const competencies: CompetencyScore[] = Object.entries(catMap)
    .map(([name, scores]) => ({ name, score: Math.round(avg(scores)) }))
    .sort((a, b) => b.score - a.score);

  const strongest = competencies[0] ?? null;
  const weakest =
    competencies.length > 0 ? competencies[competencies.length - 1] : null;

  // Recent improvement: recent-half average minus earlier-half average.
  let recentImprovement: number | null = null;
  if (total >= 2) {
    const mid = Math.floor(total / 2);
    const earlier = feedbacks.slice(0, mid).map((f) => f.totalScore);
    const recent = feedbacks.slice(mid).map((f) => f.totalScore);
    recentImprovement = Math.round(avg(recent) - avg(earlier));
  }

  const currentStreak = computeStreak(feedbacks.map((f) => f.createdAt));

  return {
    totalInterviews: total,
    averageScore,
    currentStreak,
    scoreTrend,
    competencies,
    strongest,
    weakest,
    recentImprovement,
  };
}
