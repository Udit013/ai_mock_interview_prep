import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

/**
 * Structured representation of a candidate's resume. Mirrors the `ParsedResume`
 * domain type and is used to drive resume-aware interview question generation.
 */
export const resumeSchema = z.object({
  summary: z
    .string()
    .describe("A 1-2 sentence professional summary of the candidate."),
  skills: z
    .array(z.string())
    .describe("Distinct professional skills (e.g. 'Distributed Systems')."),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z
          .string()
          .describe("One sentence on what the project does and the candidate's role."),
        technologies: z.array(z.string()),
      })
    )
    .describe("Notable projects with the technologies used in each."),
  experiences: z
    .array(
      z.object({
        company: z.string(),
        role: z.string(),
        highlights: z
          .array(z.string())
          .describe("Key accomplishments or responsibilities, one per item."),
      })
    )
    .describe("Work experiences with concrete highlights."),
  technologies: z
    .array(z.string())
    .describe("Flat list of all technologies, languages, and tools mentioned."),
});

export type ResumeSchema = z.infer<typeof resumeSchema>;

/** Minimum extracted characters before we trust a PDF is text (not scanned). */
export const MIN_RESUME_TEXT_LENGTH = 200;

export class ResumeTooShortError extends Error {
  constructor() {
    super(
      "We couldn't read enough text from this PDF — it may be image-based or scanned. Try a text-based PDF, or use manual setup instead."
    );
    this.name = "ResumeTooShortError";
  }
}

/** Actionable résumé coaching produced from the stored parsed résumé. */
export const resumeImprovementSchema = z.object({
  bulletRewrites: z
    .array(
      z.object({
        before: z.string().describe("A weak bullet/highlight from the résumé, verbatim or close to it."),
        after: z.string().describe("A stronger rewrite: action verb, specifics, measurable outcome."),
        why: z.string().describe("One sentence on what the rewrite fixes."),
      })
    )
    .min(1)
    .max(6),
  missingElements: z
    .array(z.string())
    .describe("Important things recruiters expect that this résumé lacks (metrics, links, scope, etc.)."),
  atsKeywords: z
    .array(z.string())
    .describe("Role-relevant keywords/technologies worth adding for ATS matching."),
  overallAdvice: z
    .string()
    .describe("2-3 sentences of prioritized, candid overall advice."),
});

export type ResumeImprovements = z.infer<typeof resumeImprovementSchema>;

/** Generate coaching suggestions for a stored parsed résumé. */
export async function generateResumeImprovements(
  resume: ResumeSchema
): Promise<ResumeImprovements> {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: resumeImprovementSchema,
    prompt: `You are a blunt, expert résumé coach for software/consulting candidates.
Review this structured résumé and produce concrete improvements.

Résumé:
${JSON.stringify(resume, null, 2)}

Rules:
- bulletRewrites: pick the weakest real highlights and rewrite them with strong
  action verbs, specificity, and measurable outcomes. Never invent numbers —
  use placeholders like "<X>%" where the candidate must fill in the metric.
- missingElements: what a recruiter would flag as absent.
- atsKeywords: only keywords plausibly true given their experience.
- overallAdvice: prioritized and candid, not generic praise.`,
  });

  return object;
}

/**
 * Turn raw resume text into a structured `ParsedResume` using Gemini.
 * Throws `ResumeTooShortError` when the extracted text is too small to be a
 * real resume (e.g. an image-only PDF that yielded almost no characters).
 */
export async function structureResume(rawText: string): Promise<ResumeSchema> {
  const text = rawText.trim();

  if (text.length < MIN_RESUME_TEXT_LENGTH) {
    throw new ResumeTooShortError();
  }

  // Cap the prompt size to keep latency/cost bounded on very long resumes.
  const truncated = text.slice(0, 12000);

  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: resumeSchema,
    prompt: `You are an expert technical recruiter parsing a candidate's resume.
Extract structured information from the raw resume text below.

Rules:
- Only include information actually present in the text. Do not invent skills,
  companies, or projects.
- Keep skills and technologies concise (no full sentences).
- If a section is absent, return an empty array for it.
- Prefer specific, interview-relevant details (frameworks, architectures,
  measurable outcomes) over generic filler.

Raw resume text:
"""
${truncated}
"""`,
  });

  return object;
}
