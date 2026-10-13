import { describe, it, expect } from "vitest";
import {
  questionSimilarity,
  isNearDuplicate,
  extractQuestions,
  recentOpeners,
  askedQuestions,
  buildOpening,
  buildTransition,
  TOPIC_TRANSITIONS,
  limitToOneQuestion,
  hasScriptedOpener,
  stripScriptedOpener,
} from "@/lib/interview/conversation";

describe("questionSimilarity / isNearDuplicate", () => {
  it("flags the same question reworded", () => {
    const pairs: [string, string][] = [
      [
        "How would you cache API responses?",
        "What's your approach to caching responses from an API?",
      ],
      [
        "How do database indexes speed up queries?",
        "Explain how indexes speed up database queries.",
      ],
      [
        "Tell me about a time you resolved a conflict with a teammate.",
        "Describe a time you had a conflict with a teammate and how you resolved it.",
      ],
    ];
    for (const [a, b] of pairs) {
      expect(isNearDuplicate(b, [a])).toBe(true);
    }
  });

  it("does not flag genuinely different questions on related topics", () => {
    const pairs: [string, string][] = [
      [
        "How would you cache API responses?",
        "How would you invalidate a cache when the underlying data changes?",
      ],
      [
        "How do database indexes speed up reads?",
        "What does an index cost you on writes and storage?",
      ],
      [
        "Tell me about a time you resolved a conflict with a teammate.",
        "Tell me about a time you missed a deadline.",
      ],
      [
        "Design a URL shortener for 100 million users.",
        "Design a real-time chat system for a million concurrent users.",
      ],
    ];
    for (const [a, b] of pairs) {
      expect(isNearDuplicate(b, [a])).toBe(false);
    }
  });

  it("is symmetric and bounded", () => {
    const a = "How would you scale a read-heavy service?";
    const b = "What would you do to scale a service with heavy reads?";
    expect(questionSimilarity(a, b)).toBeCloseTo(questionSimilarity(b, a));
    expect(questionSimilarity(a, a)).toBe(1);
    expect(questionSimilarity("", a)).toBe(0);
  });
});

describe("extractQuestions / askedQuestions", () => {
  it("pulls out only the sentences that are questions", () => {
    expect(
      extractQuestions(
        "Nice, the idempotency key is the right call. How long would you keep those keys around?"
      )
    ).toEqual(["How long would you keep those keys around?"]);
    expect(extractQuestions("Thanks, that's everything.")).toEqual([]);
  });

  it("collects questions from interviewer turns only", () => {
    const history = [
      { role: "assistant", content: "Hi there. What does your current team build?" },
      { role: "user", content: "Why do you ask?" },
      { role: "assistant", content: "Got it. How do you deploy it?" },
    ];
    expect(askedQuestions(history)).toEqual([
      "What does your current team build?",
      "How do you deploy it?",
    ]);
  });
});

describe("recentOpeners", () => {
  it("returns the first words of recent interviewer turns", () => {
    const history = [
      { role: "assistant", content: "That's a great point about caching. Next…" },
      { role: "user", content: "Thanks" },
      { role: "assistant", content: "That's a great point again. Now…" },
    ];
    expect(recentOpeners(history)).toEqual([
      "That's a great point",
      "That's a great point",
    ]);
  });

  it("ignores the on-screen coding problem appended to the opening", () => {
    const history = [
      {
        role: "assistant",
        content: "[Problem shown on screen]: Two sum…",
      },
    ];
    expect(recentOpeners(history)).toEqual([]);
  });
});

describe("buildOpening", () => {
  const base = {
    userName: "Sam",
    role: "Backend Engineer",
    questionCount: 5,
    firstQuestion: "Which part of your last project would you redesign today?",
  };

  it("greets by name, frames the interview, and ends on the first question", () => {
    const line = buildOpening({ ...base, seed: 0 });
    expect(line).toContain("Sam");
    expect(line).toContain("Backend Engineer");
    expect(line).toContain("5");
    expect(line.endsWith(base.firstQuestion)).toBe(true);
  });

  it("varies across seeds instead of one fixed script", () => {
    const lines = new Set([0, 1, 2].map((seed) => buildOpening({ ...base, seed })));
    expect(lines.size).toBe(3);
  });

  it("no longer uses the robotic 'Here's your first question' template", () => {
    for (let seed = 0; seed < 6; seed++) {
      expect(buildOpening({ ...base, seed })).not.toMatch(/here's your first question/i);
    }
  });

  it("handles a single topic and a missing role gracefully", () => {
    const line = buildOpening({ ...base, role: "", questionCount: 1, seed: 0 });
    expect(line).not.toMatch(/undefined|1 topics|1 areas/);
  });
});

describe("buildTransition", () => {
  it("cycles through varied transitions, including negative seeds", () => {
    const seen = new Set(TOPIC_TRANSITIONS.map((_, i) => buildTransition(i)));
    expect(seen.size).toBe(TOPIC_TRANSITIONS.length);
    expect(TOPIC_TRANSITIONS).toContain(buildTransition(-1));
  });
});

describe("limitToOneQuestion", () => {
  it("drops a stacked second question", () => {
    expect(
      limitToOneQuestion(
        "Okay, you mentioned an async issue. Could you tell me more about the bug? What made it tricky to identify?"
      )
    ).toBe("Okay, you mentioned an async issue. Could you tell me more about the bug?");
  });

  it("leaves a single question, and a closing with no question, untouched", () => {
    const one = "Right, the lock is held until commit. What happens to other writers meanwhile?";
    expect(limitToOneQuestion(one)).toBe(one);
    const close = "Thanks Sam, that's everything from me. Your feedback is on its way.";
    expect(limitToOneQuestion(close)).toBe(close);
  });
});

describe("hasScriptedOpener", () => {
  it("catches grading and filler openers", () => {
    for (const line of [
      "That's a solid plan for initial investigation. If you…",
      "That's a clear explanation of the race condition.",
      "Great answer! Now…",
      "Thank you for sharing that.",
      "Absolutely, and…",
    ]) {
      expect(hasScriptedOpener(line)).toBe(true);
    }
  });

  it("allows natural, content-led openers", () => {
    for (const line of [
      "Okay, so the second write clobbered the first.",
      "Right — the lock is held until commit.",
      "That's where I'd look too. What would the plan show?",
      "Got it.",
    ]) {
      expect(hasScriptedOpener(line)).toBe(false);
    }
  });
});

describe("stripScriptedOpener", () => {
  it("drops a graded first sentence and keeps the substance", () => {
    expect(
      stripScriptedOpener(
        "That's a solid plan for initial investigation. If EXPLAIN ANALYZE showed a sequential scan, what would you do next?"
      )
    ).toBe("If EXPLAIN ANALYZE showed a sequential scan, what would you do next?");
  });

  it("keeps the line when removing the opener would leave nothing useful", () => {
    const q = "Great, what would you change first?";
    expect(stripScriptedOpener(q)).toBe(q);
    const short = "That's a good point. Why?";
    expect(stripScriptedOpener(short)).toBe(short);
  });

  it("leaves natural openers alone", () => {
    const line = "Okay, so the second write clobbered the first. What did that cost you?";
    expect(stripScriptedOpener(line)).toBe(line);
  });
});
