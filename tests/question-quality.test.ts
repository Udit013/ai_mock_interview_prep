import { describe, it, expect } from "vitest";
import {
  sanitizeQuestions,
  meetsMinimumCount,
} from "@/lib/interview/question-quality";

describe("sanitizeQuestions", () => {
  it("keeps well-formed questions untouched", () => {
    const input = [
      "Tell me about a time you handled conflicting priorities.",
      "How would you design a rate limiter for a public API?",
    ];
    const { questions, issues } = sanitizeQuestions(input);
    expect(questions).toEqual(input);
    expect(issues).toEqual([]);
  });

  it("strips leading numbering in several formats", () => {
    const { questions } = sanitizeQuestions([
      "1. What is a database index and why does it help?",
      "Q2: How do you approach debugging a production issue?",
      "3) Describe your experience with distributed systems.",
      "- Explain the difference between TCP and UDP protocols.",
    ]);
    expect(questions[0]).toBe("What is a database index and why does it help?");
    expect(questions[1]).toBe(
      "How do you approach debugging a production issue?"
    );
    expect(questions[2]).toBe(
      "Describe your experience with distributed systems."
    );
    expect(questions[3]).toBe(
      "Explain the difference between TCP and UDP protocols."
    );
  });

  it("removes wrapping quotes", () => {
    const { questions } = sanitizeQuestions([
      '"How do you ensure code quality across a team?"',
    ]);
    expect(questions[0]).toBe("How do you ensure code quality across a team?");
  });

  it("drops near-duplicates that differ only by casing or punctuation", () => {
    const { questions, issues } = sanitizeQuestions([
      "What is a database index?",
      "what is a database index",
      "What is a Database Index?!",
      "How would you scale a write-heavy service?",
    ]);
    expect(questions).toHaveLength(2);
    expect(issues.some((i) => i.startsWith("Dropped duplicate"))).toBe(true);
  });

  it("drops fragments that are too short to be questions", () => {
    const { questions, issues } = sanitizeQuestions([
      "Why?",
      "Tell me about your experience with backend systems.",
      "",
      "   ",
    ]);
    expect(questions).toHaveLength(1);
    expect(issues.length).toBeGreaterThan(0);
  });

  it("drops non-string entries without throwing", () => {
    const { questions, issues } = sanitizeQuestions([
      "Explain how you would test this system end to end.",
      42,
      null,
      { question: "nope" },
    ]);
    expect(questions).toHaveLength(1);
    expect(issues.filter((i) => i.includes("non-string"))).toHaveLength(3);
  });

  it("returns an issue when the model didn't return a list at all", () => {
    const { questions, issues } = sanitizeQuestions({ questions: ["a"] });
    expect(questions).toEqual([]);
    expect(issues[0]).toMatch(/did not return a list/i);
  });

  it("truncates absurdly long entries rather than dropping them", () => {
    const long = "A".repeat(5000);
    const { questions } = sanitizeQuestions([long]);
    expect(questions[0].length).toBe(2000);
  });
});

describe("meetsMinimumCount", () => {
  it("accepts an exact match", () => {
    expect(meetsMinimumCount(5, 5)).toBe(true);
  });

  it("tolerates a partial shortfall", () => {
    expect(meetsMinimumCount(4, 5)).toBe(true); // floor is max(3, 3) = 3
    expect(meetsMinimumCount(6, 10)).toBe(true); // floor is max(3, 5) = 5
  });

  it("rejects a severe shortfall", () => {
    expect(meetsMinimumCount(2, 10)).toBe(false);
    expect(meetsMinimumCount(1, 5)).toBe(false);
  });

  it("rejects an empty set", () => {
    expect(meetsMinimumCount(0, 5)).toBe(false);
    expect(meetsMinimumCount(0, 3)).toBe(false);
  });

  it("never demands more than was requested", () => {
    // Asking for 3 and getting 3 is fine even though the floor is also 3.
    expect(meetsMinimumCount(3, 3)).toBe(true);
  });
});
