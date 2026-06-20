import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getRandomInterviewCover } from "@/lib/utils";
import { db } from "@/firebase/admin";
import type { ResumeSchema } from "@/lib/ai/resume";

export async function GET() {
  return Response.json({ success: true, data: "THANK YOU!" }, { status: 200 });
}

interface GenerateBody {
  type: string;
  role: string;
  level: string;
  techstack: string;
  amount: number;
  userid: string;
  source?: "manual" | "resume";
  resumeContext?: ResumeSchema;
}

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
  const body: GenerateBody = await request.json();
  const { type, role, level, techstack, amount, userid, source, resumeContext } =
    body;

  try {
    const isResume = source === "resume" && resumeContext;

    const prompt = isResume
      ? `Prepare ${amount} interview questions for a ${level} ${role} candidate, with the focus leaning towards ${type} questions.

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

    const interview = {
      role,
      type,
      level,
      techstack: techstackList,
      questions: parsedQuestions,
      userId: userid,
      finalized: true,
      source: source ?? "manual",
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
