"use server";

import { db } from "@/firebase/admin";
import {
  generateResumeImprovements,
  type ResumeSchema,
  type ResumeImprovements,
} from "@/lib/ai/resume";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Persist (or overwrite) the latest parsed resume for a user. We keep a single
 * document per user keyed by userId so "Generate from resume" always uses the
 * most recent upload.
 */
export async function saveResume({
  userId,
  parsed,
  rawTextLength,
}: {
  userId: string;
  parsed: ResumeSchema;
  rawTextLength: number;
}): Promise<{ success: boolean }> {
  try {
    await db
      .collection("resumes")
      .doc(userId)
      .set({
        userId,
        ...parsed,
        rawTextLength,
        createdAt: new Date().toISOString(),
      });

    return { success: true };
  } catch (e) {
    console.error("saveResume error:", e);
    return { success: false };
  }
}

/**
 * Coaching suggestions for the caller's stored résumé. Session-derived
 * identity; rate-limited because it drives a Gemini call.
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

    const doc = await db.collection("resumes").doc(user.id).get();
    if (!doc.exists) {
      return {
        success: false,
        error: "No résumé on file — upload one from the interview page first.",
      };
    }

    const data = doc.data() as Resume;
    const improvements = await generateResumeImprovements({
      summary: data.summary,
      skills: data.skills,
      projects: data.projects,
      experiences: data.experiences,
      technologies: data.technologies,
    });

    return { success: true, improvements };
  } catch (e) {
    console.error("suggestResumeImprovements error:", e);
    return { success: false, error: "Failed to generate suggestions." };
  }
}

export async function getResumeByUserId(
  userId: string
): Promise<Resume | null> {
  try {
    const doc = await db.collection("resumes").doc(userId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Resume;
  } catch (e) {
    console.error("getResumeByUserId error:", e);
    return null;
  }
}
