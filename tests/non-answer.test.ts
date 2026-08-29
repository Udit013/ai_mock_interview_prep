import { describe, it, expect } from "vitest";
import {
  isNonAnswer,
  buildSkipResponse,
  planSkipTurn,
} from "@/lib/interview/non-answer";

describe("isNonAnswer — clear refusals", () => {
  const refusals = [
    "I don't know",
    "I dont know",
    "I don't know the answer",
    "I really don't know",
    "I honestly don't know that one",
    "Not sure",
    "I'm not sure",
    "I am not really sure",
    "I'm not entirely sure about that",
    "No idea",
    "I have no idea",
    "I've no clue",
    "no clue",
    "I can't answer that",
    "I cannot answer",
    "I can't recall",
    "I don't remember",
    "I don't have an answer",
    "dunno",
    "I'm drawing a blank",
    "I'm blanking",
    "I give up",
    "pass",
    "skip",
    "skip this",
    "next question",
    "let's move on",
    "beats me",
    "no comment",
    "unsure",
    "I've never heard of that",
  ];

  for (const r of refusals) {
    it(`treats "${r}" as a non-answer`, () => {
      expect(isNonAnswer(r)).toBe(true);
    });
  }

  it("sees through leading filler words", () => {
    expect(isNonAnswer("Um, I don't know")).toBe(true);
    expect(isNonAnswer("Uh... well, honestly, I'm not sure")).toBe(true);
    expect(isNonAnswer("Hmm, yeah, no idea")).toBe(true);
    expect(isNonAnswer("Sorry, I don't know that one")).toBe(true);
  });

  it("treats silence and pure filler as a non-answer", () => {
    expect(isNonAnswer("")).toBe(true);
    expect(isNonAnswer("   ")).toBe(true);
    expect(isNonAnswer("um uh")).toBe(true);
  });

  it("ignores punctuation and casing", () => {
    expect(isNonAnswer("I DON'T KNOW!!!")).toBe(true);
    expect(isNonAnswer("...no idea.")).toBe(true);
  });
});

describe("isNonAnswer — must NOT skip genuine answers", () => {
  const answers = [
    // The dangerous class: starts like a refusal, then answers.
    "I don't know the exact number, but I'd estimate around 50 milliseconds",
    "I'm not sure, but I think it would be O of n log n",
    "Not sure exactly, though I believe it uses a B-tree index",
    "I don't know for certain, however my guess is a race condition",
    "No idea honestly, but maybe something related to caching",
    "I'm not certain, I'd say roughly two hundred requests per second",
    // Substantive answers.
    "An index maps key values to row locations so lookups become logarithmic",
    "I would use a sliding window with Redis sorted sets to enforce the limit",
    "I have never used Kubernetes in production but I have used Docker Compose",
    "We reduced latency by adding a read-through cache in front of Postgres",
    // Honest scoping that is still an answer.
    "I have only used it for small side projects, not at scale",
  ];

  for (const a of answers) {
    it(`does not skip: "${a.slice(0, 55)}…"`, () => {
      expect(isNonAnswer(a)).toBe(false);
    });
  }

  it("does not skip a long answer that merely contains a hedge", () => {
    const long =
      "I am not sure I remember every detail of the deployment pipeline " +
      "however we used GitHub Actions to build the container and then pushed " +
      "it to a registry before rolling it out";
    expect(isNonAnswer(long)).toBe(false);
  });

  it("does not skip when a hedge is followed by real content", () => {
    expect(isNonAnswer("I don't know, maybe hashing?")).toBe(false);
    expect(isNonAnswer("Not sure but probably indexing")).toBe(false);
  });
});

describe("buildSkipResponse", () => {
  it("acknowledges and asks the next question", () => {
    const out = buildSkipResponse("How does a hash map work?", 0);
    expect(out).toContain("No problem at all");
    expect(out).toContain("How does a hash map work?");
  });

  it("wraps up when there is no next question", () => {
    const out = buildSkipResponse(null, 0);
    expect(out).toMatch(/wrap up|last thing/i);
    expect(out).toMatch(/feedback/i);
  });

  it("varies the acknowledgement by seed", () => {
    const a = buildSkipResponse("Q", 0);
    const b = buildSkipResponse("Q", 1);
    expect(a).not.toBe(b);
  });

  it("handles out-of-range and negative seeds safely", () => {
    expect(() => buildSkipResponse("Q", 99)).not.toThrow();
    expect(() => buildSkipResponse("Q", -3)).not.toThrow();
    expect(buildSkipResponse("Q", -3)).toContain("Q");
  });
});

describe("planSkipTurn — interview progression after an unanswered question", () => {
  const questions = ["Q1 about indexes", "Q2 about caching", "Q3 about queues"];

  it("advances to the next question", () => {
    const plan = planSkipTurn({
      questions,
      currentIndex: 0,
      answersGiven: 1,
      maxExchanges: 7,
      seed: 0,
    });
    expect(plan.action).toBe("next_topic");
    expect(plan.isFinished).toBe(false);
    expect(plan.activeQuestionIndex).toBe(1);
    expect(plan.aiResponse).toContain("Q2 about caching");
    expect(plan.skippedTopic).toBe("Q1 about indexes");
  });

  it("never re-asks the question that was just skipped", () => {
    const plan = planSkipTurn({
      questions,
      currentIndex: 1,
      answersGiven: 2,
      maxExchanges: 7,
      seed: 0,
    });
    expect(plan.aiResponse).not.toContain("Q2 about caching");
    expect(plan.aiResponse).toContain("Q3 about queues");
  });

  it("finishes when the skipped question was the last one", () => {
    const plan = planSkipTurn({
      questions,
      currentIndex: 2,
      answersGiven: 3,
      maxExchanges: 7,
      seed: 0,
    });
    expect(plan.action).toBe("finish");
    expect(plan.isFinished).toBe(true);
    expect(plan.aiResponse).toMatch(/wrap up/i);
  });

  it("finishes when the exchange cap is reached even with questions left", () => {
    const plan = planSkipTurn({
      questions,
      currentIndex: 0,
      answersGiven: 7,
      maxExchanges: 7,
      seed: 0,
    });
    expect(plan.isFinished).toBe(true);
    expect(plan.action).toBe("finish");
  });

  it("clamps an out-of-range index instead of producing undefined", () => {
    const plan = planSkipTurn({
      questions,
      currentIndex: 99,
      answersGiven: 1,
      maxExchanges: 7,
      seed: 0,
    });
    expect(plan.isFinished).toBe(true);
    expect(plan.skippedTopic).toBe("Q3 about queues");
    expect(plan.aiResponse).not.toContain("undefined");
  });

  it("handles an empty question list without crashing", () => {
    const plan = planSkipTurn({
      questions: [],
      currentIndex: 0,
      answersGiven: 1,
      maxExchanges: 5,
      seed: 0,
    });
    expect(plan.isFinished).toBe(true);
    expect(plan.skippedTopic).toBe("a question");
    expect(plan.aiResponse).not.toContain("undefined");
  });

  it("walks the whole interview without repeating a question", () => {
    const asked: string[] = [];
    let index = 0;
    for (let turn = 1; turn <= questions.length; turn++) {
      const plan = planSkipTurn({
        questions,
        currentIndex: index,
        answersGiven: turn,
        maxExchanges: 10,
        seed: 0,
      });
      asked.push(plan.skippedTopic);
      index = plan.activeQuestionIndex;
      if (plan.isFinished) break;
    }
    expect(asked).toEqual(questions);
    expect(new Set(asked).size).toBe(questions.length);
  });
});
