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
