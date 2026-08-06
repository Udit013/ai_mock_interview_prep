"use server";

/**
 * SECURITY: every export here is a publicly callable RPC endpoint. Persistence
 * helpers that accept a `userId` live in `lib/data/resume.data.ts` instead, so
 * they cannot be invoked directly by a caller supplying someone else's id.
 */

import {
  generateResumeImprovements,
  type ResumeImprovements,
} from "@/lib/ai/resume";
import { getResumeByUserId } from "@/lib/data/resume.data";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Coaching suggestions for the caller's stored résumé. Takes no arguments by
 * design: the user is derived from the session, so it is structurally
 * impossible to request coaching on someone else's résumé.
 */
export async function suggestResumeImprovements(): Promise<
  | { success: true; improvements: ResumeImprovements }
  | { success: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "You must be signed in." };

    const { allowed } = await checkRateLimit(
      user.id,
      "resumeCoach",
      RATE_LIMITS.resumeCoach
    );
    if (!allowed) {
      return {
        success: false,
        error: "Daily résumé-coaching limit reached. Try again tomorrow.",
      };
    }

    const resume = await getResumeByUserId(user.id);
    if (!resume) {
      return {
        success: false,
        error: "No résumé on file — upload one from the interview page first.",
      };
    }

    const improvements = await generateResumeImprovements({
      summary: resume.summary,
      skills: resume.skills,
      projects: resume.projects,
      experiences: resume.experiences,
      technologies: resume.technologies,
    });

    return { success: true, improvements };
  } catch (e) {
    console.error("suggestResumeImprovements error:", e);
    return { success: false, error: "Failed to generate suggestions." };
  }
}
