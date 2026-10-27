import { generateText } from "ai";
import { aiAbortSignal } from "@/lib/ai/limits";
import { MODEL_MAX_RETRIES, withModelFallback } from "@/lib/ai/models";
import { z } from "zod";
import { getRandomInterviewCover } from "@/lib/utils";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { resumeSchema, type ResumeSchema } from "@/lib/ai/resume";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCompanyMode, companyPromptBlock } from "@/constants/companies";
import {
  sanitizeQuestions,
  meetsMinimumCount,
} from "@/lib/interview/question-quality";
import {
  MAX_JD_CHARS,
  jobDescriptionBlock,
  jobQuestionInstructions,
  normalizeJobDescription,
} from "@/lib/interview/job-description";

// Gemini calls are capped at 45 s (lib/ai/limits.ts); leave headroom for auth
// and Firestore. Must be a literal — Next reads it statically.
export const maxDuration = 60;

/**
 * An error whose message is safe (and useful) to show the user. Everything else
 * is logged server-side and reported generically, since upstream provider
 * errors can carry project ids and quota details.
 */
class QuestionGenerationError extends Error {
  readonly userFacing = true;
}

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
  // Optional pasted job posting. Bounded generously (raw pastes carry extra
  // whitespace); normalised and capped before use.
  jobDescription: z.string().max(MAX_JD_CHARS * 2).optional(),
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
      jobDescription: rawJobDescription,
    } = parsedBody.data;

    // Only persist known company modes; unknown ids degrade to generic.
    const company = getCompanyMode(companyMode);
    const companyBlock = companyPromptBlock(company?.id);
    const isResume = source === "resume" && resumeContext;
    // Tech stack is optional — when absent the model infers what the role needs.
    const hasTechstack = Boolean(techstack && techstack.trim());
    // A job description targets the whole set at one posting; with a résumé it
    // becomes a real-interview mix of overlap, gap, and fit questions.
    const jobDescription = normalizeJobDescription(rawJobDescription);
    const jobBlock = jobDescription
      ? `\n${jobDescriptionBlock(jobDescription)}\n\n${jobQuestionInstructions({
          type,
          amount,
          hasResume: Boolean(isResume),
        })}\n`
      : "";

    const typeInstructions =
      type === "Coding"
        ? `Each question must be a self-contained coding problem: a short realistic scenario, the task, input/output expectations, and one example. The candidate solves it in an editor while talking, so make each solvable in 15-25 minutes. Vary the problem families (e.g. arrays/strings, hashing, trees/graphs, intervals, design-a-class) — never two problems that use the same core technique.`
        : type === "System Design"
        ? `Each question should be an open-ended system design prompt framed as a real product need with a hint of scale (users, traffic, data size), so the candidate must clarify requirements, estimate, and make trade-offs. Cover different kinds of systems (e.g. read-heavy, write-heavy, real-time, storage-heavy) rather than variations of one.`
        : type === "Behavioral"
        ? `These are behavioral questions. Each must target a different competency (e.g. ownership, conflict, ambiguity, failure, influence, prioritisation, feedback) and ask for one specific real situation. Do not open more than two questions with "Tell me about a time".`
        : "";

    // The same craft rules apply to manual and résumé interviews.
    const craftRules = `How a strong human interviewer writes these:
- Plan the set first: give every question a DIFFERENT focus area. No two questions may test the same concept, even if worded differently.
- Mix formats across the set: a real-world scenario, a trade-off or "what would you choose and why", a debugging or "what went wrong" situation, a past-experience question, and (for senior levels) a design or judgement call.
- Order them like a real interview: one approachable warm-up first, then core questions, then one or two stretch questions at the end. Pitch the difficulty at a ${level} candidate.
- Write each as it would be SPOKEN by an experienced interviewer: conversational, direct, under 45 words (coding problems may be longer). Ask one thing — at most a single "and why?" or "what would you change?" add-on.
- Ground questions in realistic situations from the role's day-to-day work instead of textbook definitions ("What is latency?").
- Never start two questions with the same three words. Avoid robotic openers like "Can you explain", "Describe the concept of", "What are the key characteristics of", "Discuss".

Weak (do not write like this):
- "Can you explain what a REST API is?"
- "What are the advantages and disadvantages of microservices?"
- "Describe the concept of caching."

Strong:
- "Say a teammate proposes splitting our monolith into microservices next quarter. What would you want to know before agreeing?"
- "A page that used to load in 300 milliseconds now takes three seconds after a release. Where do you start looking?"
- "Which part of a project you've built would you redesign today, and why?"

These examples only show the STYLE. Never reuse their scenarios or wording — write fresh situations specific to this role and stack.`;

    const outputRules = `The questions are read aloud by a voice assistant, so do not use "/", "*", markdown, or other special characters, and do not number them or add commentary.
Return ONLY a JSON array of strings, like:
["Question 1", "Question 2", "Question 3"]`;

    const prompt = isResume
      ? `You are an experienced interviewer preparing ${amount} questions for a ${level} ${role} candidate, leaning towards ${type} questions.
${companyBlock}${typeInstructions}

Base the questions on THIS candidate's actual résumé below. Reference their real projects, technologies, and decisions by name, and probe the "why" behind their choices and the depth of their ownership. Spread the questions across different projects and skills rather than drilling one project repeatedly.

${buildResumeContext(resumeContext)}
${jobBlock}
Good résumé-aware questions sound like:
- "In <their project> you went with <technology> — what else did you consider, and what tipped the decision?"
- "Walk me through what actually happens when a user hits <feature> in <their project>."
- "What broke in <their project> that you didn't see coming, and how did you find it?"

${craftRules}

${outputRules}`
      : `You are an experienced interviewer preparing ${amount} questions for a ${level} ${role} interview, leaning towards ${type} questions.
${
  hasTechstack
    ? `The team's stack is: ${techstack}. Ground technical questions in it, but spread them across different parts of the stack.`
    : jobDescription
    ? `No tech stack was specified separately — take the skills and tools from the job description.`
    : `No tech stack was specified. Infer the skills and tools a ${level} ${role} is actually expected to know, and ground technical questions in those. Do not ask the candidate which technologies they use — choose sensible ones for the role yourself.`
}
${companyBlock}${typeInstructions}
${jobBlock}
${craftRules}

${outputRules}`;

    const { text: questions } = await withModelFallback("quality", (model) => generateText({
      model,
      maxRetries: MODEL_MAX_RETRIES,
      abortSignal: aiAbortSignal(),
      prompt,
    }));

    // Gemini often wraps JSON in markdown fences (```json ... ```); strip them before parsing.
    const cleaned = questions
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    // Validate the shape, not just that it parsed: the model sometimes returns
    // an object wrapper or nested arrays, which would previously be stored
    // as-is and break the interview page at render time.
    let rawQuestions: unknown;
    try {
      rawQuestions = JSON.parse(cleaned);
    } catch {
      throw new QuestionGenerationError(
        "The AI returned an unreadable response. Please try generating again."
      );
    }

    // Strip numbering/bullets, drop fragments, and remove near-duplicates so a
    // sloppy generation can't produce a repetitive or broken interview.
    const { questions: parsedQuestions, issues } = sanitizeQuestions(rawQuestions);
    if (issues.length > 0) {
      console.warn("generate interview — question issues:", issues);
    }

    if (!meetsMinimumCount(parsedQuestions.length, amount)) {
      throw new QuestionGenerationError(
        "The AI didn't return enough usable questions. Please try again — adding a tech stack or a more specific role helps."
      );
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
      // Kept so the live interviewer and the feedback stay anchored to the job.
      ...(jobDescription ? { jobDescription } : {}),
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    // Log the real cause server-side, but only echo messages we authored:
    // upstream provider errors can carry project ids and quota details.
    console.error("generate interview error:", error);

    const message =
      error instanceof QuestionGenerationError
        ? error.message
        : "Couldn't generate the interview right now. Please try again in a moment.";

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
