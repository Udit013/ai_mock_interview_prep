import { describe, it, expect } from "vitest";
import {
  maxExchangesFor,
  DEFAULT_INTERVIEW_STATE,
  interviewStateSchema,
  adaptiveTurnSchema,
} from "@/lib/ai/adaptive";

describe("maxExchangesFor (deterministic termination cap)", () => {
  it("allows seed questions plus four adaptive follow-ups", () => {
    expect(maxExchangesFor(3)).toBe(7);
    expect(maxExchangesFor(5)).toBe(9);
  });

  it("caps at 12 total exchanges regardless of seed count", () => {
    expect(maxExchangesFor(10)).toBe(12);
    expect(maxExchangesFor(15)).toBe(12);
    expect(maxExchangesFor(100)).toBe(12);
  });

  it("treats zero/negative seeds as at least one topic", () => {
    expect(maxExchangesFor(0)).toBe(5);
    expect(maxExchangesFor(-3)).toBe(5);
  });
});

describe("interview state schemas", () => {
  it("accepts the default state", () => {
    expect(interviewStateSchema.safeParse(DEFAULT_INTERVIEW_STATE).success).toBe(
      true
    );
  });

  it("rejects out-of-range confidence", () => {
    expect(
      interviewStateSchema.safeParse({
        ...DEFAULT_INTERVIEW_STATE,
        estimatedConfidence: 150,
      }).success
    ).toBe(false);
  });

  it("rejects unknown difficulty levels", () => {
    expect(
      interviewStateSchema.safeParse({
        ...DEFAULT_INTERVIEW_STATE,
        difficulty: "impossible",
      }).success
    ).toBe(false);
  });

  it("rejects turns with unknown actions", () => {
    expect(
      adaptiveTurnSchema.safeParse({
        evaluation: { depth: "strong", note: "good" },
        action: "give_up",
        updatedState: DEFAULT_INTERVIEW_STATE,
        spokenResponse: "Next question…",
      }).success
    ).toBe(false);
  });
});

import { fallbackTurn } from "@/lib/ai/adaptive";
import { isDegenerateReply } from "@/lib/interview/speech-text";

describe("fallbackTurn (used when the model's reply is unusable twice)", () => {
  const seeds = ["Q1 about indexes?", "Q2 about caching?", "Q3 about queues?"];

  it("bridges naturally to the next question and keeps the state", () => {
    const t = fallbackTurn({ seedQuestions: seeds, currentIndex: 0, currentState: DEFAULT_INTERVIEW_STATE, mustFinish: false });
    expect(t.action).toBe("next_topic");
    expect(t.activeQuestionIndex).toBe(1);
    expect(t.spokenResponse).toContain("Q2 about caching?");
    expect(t.updatedState).toEqual(DEFAULT_INTERVIEW_STATE);
    expect(isDegenerateReply(t.spokenResponse)).toBe(false);
    expect(adaptiveTurnSchema.safeParse(t).success).toBe(true);
  });

  it("closes the interview on the last question or at the cap", () => {
    for (const args of [
      { currentIndex: 2, mustFinish: false },
      { currentIndex: 0, mustFinish: true },
    ]) {
      const t = fallbackTurn({ seedQuestions: seeds, currentState: DEFAULT_INTERVIEW_STATE, ...args });
      expect(t.action).toBe("finish");
      expect(t.spokenResponse).toMatch(/feedback/i);
      expect(adaptiveTurnSchema.safeParse(t).success).toBe(true);
    }
  });
});
