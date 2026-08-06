import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getResumeByUserId } from "@/lib/data/resume.data";
import ResumeCoach from "@/components/ResumeCoach";
import ResumeUpload from "@/components/ResumeUpload";

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resume = await getResumeByUserId(user.id);

  if (!resume) {
    return (
      <section className="flex flex-col gap-4 items-start">
        <h2>Résumé Coach</h2>
        <p className="text-light-400">
          Upload your résumé (PDF) to get AI-powered improvement suggestions —
          bullet rewrites, missing elements, and ATS keywords.
        </p>
        <ResumeUpload label="Upload résumé (PDF)" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col">
        <div className="flex flex-col gap-1">
          <h2>Résumé Coach</h2>
          <p className="text-light-400">{resume.summary}</p>
        </div>
        <ResumeUpload label="Replace résumé" variant="secondary" />
      </div>

      <div className="flex flex-wrap gap-2">
        {resume.skills.slice(0, 14).map((s) => (
          <span key={s} className="rounded-full bg-dark-300 px-3 py-1 text-xs">
            {s}
          </span>
        ))}
      </div>

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
