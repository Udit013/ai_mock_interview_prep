import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getRandomInterviewCover } from "@/lib/utils";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { resumeSchema, type ResumeSchema } from "@/lib/ai/resume";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCompanyMode, companyPromptBlock } from "@/constants/companies";

export async function GET() {
  return Response.json({ success: true, data: "THANK YOU!" }, { status: 200 });
}

// Identity comes from the session cookie, never from the request body.
const generateBodySchema = z.object({
  type: z.enum(["Technical", "Behavioral", "Mixed", "System Design", "Coding"]),
  role: z.string().min(2).max(100),
  level: z.enum(["Junior", "Mid", "Senior"]),
  techstack: z.string().max(300).optional().default(""),
  amount: z.coerce.number().int().min(3).max(15),
  source: z.enum(["manual", "resume"]).optional(),
  resumeContext: resumeSchema.optional(),
  visibility: z.enum(["public", "private"]).optional(),
  companyMode: z.string().max(30).optional(),
});

/**
 * Condense a parsed resume into a compact, prompt-friendly block so generated
 * questions can reference the candidate's actual projects and experience.
 */
function buildResumeContext(resume: ResumeSchema): string {
  const projects = resume.projects
    .slice(0, 6)
    .map(
      (p) =>
        `- ${p.name}: ${p.description}${
          p.technologies.length ? ` (tech: ${p.technologies.join(", ")})` : ""
        }`
    )
    .join("\n");

  const experiences = resume.experiences
    .slice(0, 5)
    .map(
      (e) =>
        `- ${e.role} at ${e.company}: ${e.highlights.slice(0, 3).join("; ")}`
    )
    .join("\n");

  return `Candidate summary: ${resume.summary}
Skills: ${resume.skills.join(", ")}
Technologies: ${resume.technologies.join(", ")}

Projects:
${projects || "(none listed)"}

Experience:
${experiences || "(none listed)"}`;
}

export async function POST(request: Request) {
  try {
    // Auth: derive identity from the session; reject anonymous callers so the
    // Gemini quota can't be burned and interviews can't be forged for others.
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { allowed } = await checkRateLimit(
      user.id,
      "generate",
      RATE_LIMITS.generateInterview
    );
    if (!allowed) {
      return Response.json(
        {
          success: false,
          error: "Daily interview-generation limit reached. Try again tomorrow.",
        },
        { status: 429 }
      );
    }

    const parsedBody = generateBodySchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return Response.json(
        { success: false, error: "Invalid request." },
        { status: 400 }
      );
    }
    const {
      type,
      role,
      level,
      techstack,
      amount,
      source,
      resumeContext,
      visibility,
      companyMode,
    } = parsedBody.data;

    // Only persist known company modes; unknown ids degrade to generic.
    const company = getCompanyMode(companyMode);
    const companyBlock = companyPromptBlock(company?.id);
    const isResume = source === "resume" && resumeContext;

    const typeInstructions =
      type === "Coding"
        ? `Each question must be a self-contained coding problem: a short scenario, the task, input/output expectations, and one example. The candidate will solve it in a code editor while talking, so make problems solvable in 15-25 minutes and speakable aloud.`
        : type === "System Design"
        ? `Each question should be an open-ended system design prompt (e.g. "Design a URL shortener for 100M users"). Include a hint of scale so the candidate must estimate and make trade-offs.`
        : "";

    const prompt = isResume
      ? `Prepare ${amount} interview questions for a ${level} ${role} candidate, with the focus leaning towards ${type} questions.
${companyBlock}${typeInstructions}

Base the questions on THIS candidate's actual resume below. Reference their real projects, technologies, and decisions. Probe the "why" behind their choices and the depth of their experience.

${buildResumeContext(resumeContext)}

Good examples of resume-aware questions:
- "Why did you choose <technology> over <alternative> in <their project>?"
- "Walk me through the architecture of <their project>."
- "What was the hardest trade-off you made while building <their project>?"

The questions will be read aloud by a voice assistant, so do not use "/", "*", or other special characters.
Return ONLY a JSON array of strings, like:
["Question 1", "Question 2", "Question 3"]`
      : `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        ${companyBlock}${typeInstructions}
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]

        Thank you! <3
    `;

    const { text: questions } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });

    // Gemini often wraps JSON in markdown fences (```json ... ```); strip them before parsing.
    const cleaned = questions
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let parsedQuestions: string[];
    try {
      parsedQuestions = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse questions returned by the AI model.");
    }

    // For resume interviews with no explicit tech stack, derive it from the resume.
    const techstackList =
      techstack && techstack.trim()
        ? techstack.split(",")
        : isResume
        ? resumeContext.technologies.slice(0, 8)
        : [];

    // Résumé interviews default to private (they reference personal experience);
    // manual interviews default to public unless the user chose otherwise.
    const resolvedVisibility =
      visibility ?? (source === "resume" ? "private" : "public");

    const interview = {
      role,
      type,
      level,
      techstack: techstackList,
      questions: parsedQuestions,
      userId: user.id,
      finalized: true,
      source: source ?? "manual",
      visibility: resolvedVisibility,
      ...(company ? { companyMode: company.id } : {}),
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("generate interview error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to generate interview.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
