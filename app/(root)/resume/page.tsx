import type { Metadata } from "next";
import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getResumeByUserId } from "@/lib/data/resume.data";
import ResumeCoach from "@/components/ResumeCoach";
import ResumeUpload from "@/components/ResumeUpload";

// Server actions run inside this page's function, so this bounds
// suggestResumeImprovements's Gemini call (capped at 45 s in lib/ai/limits.ts).
export const maxDuration = 60;

export const metadata: Metadata = { title: "Résumé Coach" };

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resume = await getResumeByUserId(user.id);

  if (!resume) {
    return (
      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="page-title">Résumé Coach</h1>
          <p className="text-light-400 max-w-2xl">
            Upload your résumé once and use it two ways: get blunt, specific
            improvement suggestions, and practise interviews built around your
            real projects.
          </p>
        </div>

        <div className="card-border w-full max-w-2xl">
          <div className="card flex flex-col items-start gap-6 p-8 max-sm:p-6">
            <ul className="flex list-none flex-col gap-3 p-0">
              {[
                ["Bullet rewrites", "stronger verbs and measurable outcomes"],
                ["Gap check", "what a recruiter would flag as missing"],
                ["ATS keywords", "only ones your experience supports"],
              ].map(([title, text]) => (
                <li key={title} className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 text-success-100">✓</span>
                  <p>
                    <strong className="text-white">{title}</strong> — {text}
                  </p>
                </li>
              ))}
            </ul>
            <ResumeUpload label="Upload résumé (PDF)" />
            <p className="text-xs text-light-400">
              PDF only, text-based (scans and images can&apos;t be read). Your
              résumé stays private to your account.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Résumé Coach</h1>
          <p className="text-light-400">{resume.summary}</p>
        </div>
        <ResumeUpload label="Replace résumé" variant="secondary" />
      </div>

      <ul
        aria-label="Skills detected in your résumé"
        className="flex list-none flex-wrap gap-2 p-0"
      >
        {resume.skills.slice(0, 14).map((s) => (
          <li
            key={s}
            className="rounded-full border border-white/5 bg-dark-300 px-3 py-1 text-xs text-light-100"
          >
            {s}
          </li>
        ))}
      </ul>

      {resume.projects.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg">On file</h3>
          <ul className="list-disc pl-5 text-light-400 text-sm">
            {resume.projects.map((p) => (
              <li key={p.name}>
                {p.name} — {p.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <hr className="border-dark-300" />

      <ResumeCoach />
    </section>
  );
};

export default Page;
