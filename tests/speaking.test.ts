import { describe, it, expect } from "vitest";
import {
  analyzeSpeaking,
  countFillerWords,
  computeWpm,
  wordCount,
  buildSpeakingInsights,
} from "@/lib/analytics/speaking";

describe("countFillerWords", () => {
  it("counts common fillers", () => {
    const { total } = countFillerWords("Um, so I basically think, you know?");
    expect(total).toBe(4); // um, so, basically, you know
  });

  it("respects word boundaries — 'also' is not 'so', 'unlike' is not 'like'", () => {
    const { total, used } = countFillerWords("I also walked, unlike before.");
    expect(total).toBe(0);
    expect(used).toEqual([]);
  });

  it("counts multi-word fillers like 'you know' and 'i mean'", () => {
    const { used } = countFillerWords("you know, i mean, you know");
    const map = Object.fromEntries(used.map((u) => [u.word, u.count]));
    expect(map["you know"]).toBe(2);
    expect(map["i mean"]).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(countFillerWords("UM... Basically LIKE").total).toBe(3);
  });

  it("returns empty for clean speech", () => {
    const { total, used } = countFillerWords(
      "I designed the system around idempotent consumers."
    );
    expect(total).toBe(0);
    expect(used).toHaveLength(0);
  });
});

describe("wordCount / computeWpm", () => {
  it("counts words across whitespace", () => {
    expect(wordCount("  one   two\nthree ")).toBe(3);
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
  });

  it("computes words per minute", () => {
    expect(computeWpm(150, 60)).toBe(150);
    expect(computeWpm(75, 30)).toBe(150);
  });

  it("returns 0 wpm for zero or negative duration", () => {
    expect(computeWpm(100, 0)).toBe(0);
    expect(computeWpm(100, -5)).toBe(0);
  });
});

describe("buildSpeakingInsights", () => {
  it("handles the no-data case", () => {
    const insights = buildSpeakingInsights({
      fillerWordCount: 0,
      wordsPerMinute: 0,
      totalWords: 0,
      durationSeconds: 0,
    });
    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatch(/not enough/i);
  });

  it("praises clean delivery and ideal pace", () => {
    const insights = buildSpeakingInsights({
      fillerWordCount: 0,
      wordsPerMinute: 140,
      totalWords: 300,
      durationSeconds: 130,
    });
    expect(insights.some((i) => /no detectable filler/i.test(i))).toBe(true);
    expect(insights.some((i) => /ideal range/i.test(i))).toBe(true);
  });

  it("flags fast speech and heavy filler use", () => {
    const insights = buildSpeakingInsights({
      fillerWordCount: 14,
      wordsPerMinute: 200,
      totalWords: 400,
      durationSeconds: 120,
    });
    expect(insights.some((i) => /14 times/.test(i))).toBe(true);
    expect(insights.some((i) => /quickly/.test(i))).toBe(true);
  });
});

describe("analyzeSpeaking", () => {
  it("aggregates turns and durations into one report", () => {
    const report = analyzeSpeaking(
      ["Um, I built a cache layer.", "It cut latency by forty percent."],
      [8, 7]
    );
    expect(report.totalWords).toBe(12);
    expect(report.durationSeconds).toBe(15);
    expect(report.wordsPerMinute).toBe(48); // 12 words / 15s * 60
    expect(report.fillerWordCount).toBe(1);
    expect(report.fillerWordsUsed[0]).toEqual({ word: "um", count: 1 });
    expect(report.insights.length).toBeGreaterThan(0);
  });

  it("survives empty input", () => {
    const report = analyzeSpeaking([], []);
    expect(report.totalWords).toBe(0);
    expect(report.wordsPerMinute).toBe(0);
    expect(report.insights[0]).toMatch(/not enough/i);
  });
});
