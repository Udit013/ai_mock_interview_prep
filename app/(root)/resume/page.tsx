import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getResumeByUserId } from "@/lib/actions/resume.action";
import ResumeCoach from "@/components/ResumeCoach";
import { Button } from "@/components/ui/button";

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resume = await getResumeByUserId(user.id);

  if (!resume) {
    return (
      <section className="flex flex-col gap-4 items-start">
        <h2>Résumé Coach</h2>
        <p className="text-light-400">
          You haven&apos;t uploaded a résumé yet. Upload one while creating an
          interview and it will appear here for AI coaching.
        </p>
        <Button asChild className="btn-primary">
          <Link href="/interview">Upload via Create Interview</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2>Résumé Coach</h2>
        <p className="text-light-400">{resume.summary}</p>
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
