"use server";

import { db } from "@/firebase/admin";
import type { ResumeSchema } from "@/lib/ai/resume";

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
