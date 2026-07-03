import { describe, it, expect } from "vitest";
import {
  structureResume,
  resumeSchema,
  ResumeTooShortError,
  MIN_RESUME_TEXT_LENGTH,
} from "@/lib/ai/resume";

describe("structureResume guard", () => {
  it("throws ResumeTooShortError for image-only/short PDFs before calling the model", async () => {
    await expect(structureResume("just a few words")).rejects.toBeInstanceOf(
      ResumeTooShortError
    );
  });

  it("throws for whitespace padding around short text", async () => {
    const padded = "   short   ".padEnd(MIN_RESUME_TEXT_LENGTH + 50, " ");
    await expect(structureResume(padded)).rejects.toBeInstanceOf(
      ResumeTooShortError
    );
  });

  it("carries a user-facing message", async () => {
    await expect(structureResume("x")).rejects.toThrow(/image-based|scanned/i);
  });
});

describe("resumeSchema", () => {
  it("accepts a well-formed parsed resume", () => {
    const result = resumeSchema.safeParse({
      summary: "ML engineer.",
      skills: ["NLP"],
      projects: [
        { name: "P", description: "d", technologies: ["PyTorch"] },
      ],
      experiences: [
        { company: "Acme", role: "Intern", highlights: ["Shipped X"] },
      ],
      technologies: ["PyTorch"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a resume missing required sections", () => {
    expect(resumeSchema.safeParse({ summary: "x" }).success).toBe(false);
  });
});
