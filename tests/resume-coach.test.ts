import { describe, it, expect } from "vitest";
import { resumeImprovementSchema } from "@/lib/ai/resume";

describe("resumeImprovementSchema", () => {
  it("accepts a well-formed coaching payload", () => {
    const result = resumeImprovementSchema.safeParse({
      bulletRewrites: [
        {
          before: "Worked on backend",
          after: "Rebuilt the ingest pipeline in Node.js, cutting p99 latency by <X>%",
          why: "Adds an action verb, specificity, and a measurable outcome.",
        },
      ],
      missingElements: ["No GitHub or portfolio links"],
      atsKeywords: ["PostgreSQL", "CI/CD"],
      overallAdvice: "Lead every bullet with impact.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty rewrites and oversized payloads", () => {
    expect(
      resumeImprovementSchema.safeParse({
        bulletRewrites: [],
        missingElements: [],
        atsKeywords: [],
        overallAdvice: "x",
      }).success
    ).toBe(false);
    expect(
      resumeImprovementSchema.safeParse({
        bulletRewrites: Array.from({ length: 7 }, () => ({
          before: "a",
          after: "b",
          why: "c",
        })),
        missingElements: [],
        atsKeywords: [],
        overallAdvice: "x",
      }).success
    ).toBe(false);
  });
});
