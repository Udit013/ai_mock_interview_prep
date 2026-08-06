import { describe, it, expect } from "vitest";
import { computeProgress } from "@/lib/analytics/progress";

const day = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();

const fb = (
  score: number,
  daysAgo: number,
  categories: Record<string, number> = {}
): Feedback =>
  ({
    id: `f${daysAgo}`,
    interviewId: `i${daysAgo}`,
    userId: "u1",
    totalScore: score,
    categoryScores: Object.entries(categories).map(([name, s]) => ({
      name,
      score: s,
      comment: "",
    })),
    strengths: [],
    areasForImprovement: [],
    finalAssessment: "",
    createdAt: iso(daysAgo),
  }) as Feedback;

describe("computeProgress", () => {
  it("returns an empty summary when there is no feedback", () => {
    const p = computeProgress([]);
    expect(p.totalInterviews).toBe(0);
    expect(p.averageScore).toBe(0);
    expect(p.currentStreak).toBe(0);
    expect(p.strongest).toBeNull();
    expect(p.weakest).toBeNull();
    expect(p.recentImprovement).toBeNull();
  });

  it("aggregates totals, average, and an ascending score trend", () => {
    const p = computeProgress([fb(70, 1), fb(55, 3), fb(62, 2)]);
    expect(p.totalInterviews).toBe(3);
    expect(p.averageScore).toBe(62); // (55+62+70)/3 = 62.33 → 62
    expect(p.scoreTrend.map((s) => s.score)).toEqual([55, 62, 70]); // oldest → newest
  });

  it("ranks competencies and identifies strongest/weakest", () => {
    const p = computeProgress([
      fb(70, 2, { Communication: 60, "Technical Knowledge": 80 }),
      fb(80, 1, { Communication: 70, "Technical Knowledge": 90 }),
    ]);
    expect(p.competencies).toEqual([
      { name: "Technical Knowledge", score: 85 },
      { name: "Communication", score: 65 },
    ]);
    expect(p.strongest?.name).toBe("Technical Knowledge");
    expect(p.weakest?.name).toBe("Communication");
  });

  it("computes recent improvement as recent-half minus earlier-half", () => {
    // earlier half [55, 62] = 58.5 ; recent half [70, 78] = 74 → +16 (rounded)
    const p = computeProgress([fb(55, 3), fb(62, 2), fb(70, 1), fb(78, 0)]);
    expect(p.recentImprovement).toBe(16);
  });

  it("counts a consecutive-day streak ending today", () => {
    const p = computeProgress([fb(60, 0), fb(60, 1), fb(60, 2)]);
    expect(p.currentStreak).toBe(3);
  });

  it("keeps the streak alive when the last activity was yesterday", () => {
    const p = computeProgress([fb(60, 1), fb(60, 2)]);
    expect(p.currentStreak).toBe(2);
  });

  it("breaks the streak once a full day is skipped", () => {
    const p = computeProgress([fb(60, 0), fb(60, 3), fb(60, 4)]);
    expect(p.currentStreak).toBe(1); // only today counts
  });

  it("reports no streak when the last activity is older than yesterday", () => {
    const p = computeProgress([fb(60, 5), fb(60, 6)]);
    expect(p.currentStreak).toBe(0);
  });

  it("ignores documents without a numeric score", () => {
    const broken = { ...fb(60, 1), totalScore: undefined } as unknown as Feedback;
    const p = computeProgress([fb(80, 0), broken]);
    expect(p.totalInterviews).toBe(1);
    expect(p.averageScore).toBe(80);
  });

  it("counts multiple interviews on the same day as one streak day", () => {
    const p = computeProgress([fb(60, 0), fb(70, 0), fb(80, 1)]);
    expect(p.currentStreak).toBe(2);
    expect(p.totalInterviews).toBe(3);
  });
});
