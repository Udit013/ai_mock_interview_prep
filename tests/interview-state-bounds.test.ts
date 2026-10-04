import { describe, it, expect } from "vitest";
import {
  DEFAULT_INTERVIEW_STATE,
  boundInterviewState,
  interviewStateInputSchema,
  STATE_LIST_MAX,
  STATE_ITEM_MAX_CHARS,
} from "@/lib/ai/adaptive";

const many = (n: number, len = 10) =>
  Array.from({ length: n }, (_, i) => `${i}:`.padEnd(len, "x"));

describe("boundInterviewState", () => {
  it("leaves a normal-sized state untouched", () => {
    const state = {
      ...DEFAULT_INTERVIEW_STATE,
      strengths: ["clear structure"],
      weaknesses: ["vague on indexes"],
    };
    expect(boundInterviewState(state)).toEqual(state);
  });

  it("keeps only the most recent entries of each list", () => {
    const out = boundInterviewState({
      ...DEFAULT_INTERVIEW_STATE,
      topicsCovered: many(50),
    });
    expect(out.topicsCovered).toHaveLength(STATE_LIST_MAX);
    // Newest entries carry the latest signal, so those are the ones kept.
    expect(out.topicsCovered[STATE_LIST_MAX - 1]).toMatch(/^49:/);
  });

  it("truncates overlong entries", () => {
    const out = boundInterviewState({
      ...DEFAULT_INTERVIEW_STATE,
      weaknesses: ["y".repeat(4000)],
    });
    expect(out.weaknesses[0]).toHaveLength(STATE_ITEM_MAX_CHARS);
  });
});

describe("interviewStateInputSchema (request validation)", () => {
  it("trims an oversized but plausible state instead of rejecting it", () => {
    // A long interview must never start failing with 400 mid-session.
    const parsed = interviewStateInputSchema.safeParse({
      ...DEFAULT_INTERVIEW_STATE,
      strengths: many(60, 1000),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.strengths).toHaveLength(STATE_LIST_MAX);
      expect(parsed.data.strengths[0].length).toBeLessThanOrEqual(
        STATE_ITEM_MAX_CHARS
      );
    }
  });

  it("rejects absurd payloads outright", () => {
    expect(
      interviewStateInputSchema.safeParse({
        ...DEFAULT_INTERVIEW_STATE,
        followUpOpportunities: many(5000),
      }).success
    ).toBe(false);
    expect(
      interviewStateInputSchema.safeParse({
        ...DEFAULT_INTERVIEW_STATE,
        weaknesses: ["z".repeat(100_000)],
      }).success
    ).toBe(false);
  });

  it("still enforces the field types and ranges", () => {
    expect(
      interviewStateInputSchema.safeParse({
        ...DEFAULT_INTERVIEW_STATE,
        estimatedConfidence: 400,
      }).success
    ).toBe(false);
  });

  it("caps the serialized prompt contribution", () => {
    const parsed = interviewStateInputSchema.parse({
      ...DEFAULT_INTERVIEW_STATE,
      strengths: many(200, 5000),
      weaknesses: many(200, 5000),
      topicsCovered: many(200, 5000),
      followUpOpportunities: many(200, 5000),
    });
    // 4 lists × 20 entries × 300 chars, plus JSON punctuation.
    expect(JSON.stringify(parsed).length).toBeLessThan(26_000);
  });
});
