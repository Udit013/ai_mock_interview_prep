import type { Metadata } from "next";
import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Agent from "@/components/Agent";
import CodingInterview from "@/components/CodingInterview";
import DisplayTechIcons from "@/components/DisplayTechIcons";
import InterviewAvatar from "@/components/InterviewAvatar";
import { getCompanyMode } from "@/constants/companies";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewById,
  getFeedbackByInterviewId,
} from "@/lib/data/interview.data";

// Server actions run inside this page's function, so this bounds
// createFeedback's Gemini call (capped at 45 s in lib/ai/limits.ts).
export const maxDuration = 60;

export const metadata: Metadata = { title: "Interview" };

const Page = async ({ params, searchParams }: RouteParams) => {
  const { id } = await params;
  // Set by "Start interview now" on the create form.
  const autoStart = (await searchParams)?.start === "1";

  const [user, interview] = await Promise.all([
    getCurrentUser(),
    getInterviewById(id),
  ]);

  if (!user) redirect("/sign-in");
  // Deleted interviews can't be taken again (existing reports stay viewable).
  if (!interview || interview.deleted) redirect("/");
  // Private interviews are owner-only — visibility must hold for direct URLs
  // too, not just the community feed.
  if (interview.visibility === "private" && interview.userId !== user.id) {
    redirect("/");
  }

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });

  const company = getCompanyMode(interview.companyMode);

  return (
    <>
      <Link
        href="/"
        className="w-fit text-sm text-light-400 transition-colors hover:text-white"
      >
        <span aria-hidden="true">←</span> Dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dark-300 bg-dark-200/40 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <InterviewAvatar
            company={interview.companyName}
            role={interview.role}
            size={44}
          />
          <div className="flex flex-col">
            <h1 className="capitalize leading-tight text-2xl font-semibold">
              {interview.role} Interview
            </h1>
            <p className="text-xs text-light-400 capitalize">
              {interview.level} level
              {interview.companyName ? ` · ${interview.companyName}` : ""}
              {company && company.name !== interview.companyName
                ? ` · ${company.name} style`
                : ""}
            </p>
          </div>

          <DisplayTechIcons techStack={interview.techstack} />
        </div>

        <div className="flex items-center gap-2">
          {company && (
            <span className="rounded-lg bg-primary-200/15 border border-primary-200/30 px-3 py-1.5 text-xs text-primary-100">
              {company.name}
            </span>
          )}
          {interview.jobDescription && (
            <span
              title="Questions, follow-ups and feedback target the job description you pasted"
              className="rounded-lg border border-success-100/30 bg-success-100/10 px-3 py-1.5 text-xs text-success-100"
            >
              Job-targeted
            </span>
          )}
          <span className="rounded-lg bg-dark-200 px-4 py-2 text-sm capitalize">
            {interview.type}
          </span>
        </div>
      </div>

      {interview.type === "Coding" ? (
        <CodingInterview
          userName={user.name}
          userId={user.id}
          interviewId={id}
          feedbackId={feedback?.id}
          questions={interview.questions}
          role={interview.role}
          level={interview.level}
          companyMode={interview.companyMode}
          jobDescription={interview.jobDescription}
          companyName={interview.companyName}
          autoStart={autoStart}
        />
      ) : (
        <Agent
          userName={user.name}
          userId={user.id}
          interviewId={id}
          feedbackId={feedback?.id}
          type="interview"
          questions={interview.questions}
          role={interview.role}
          level={interview.level}
          interviewType={interview.type}
          companyMode={interview.companyMode}
          jobDescription={interview.jobDescription}
          companyName={interview.companyName}
          autoStart={autoStart}
        />
      )}
    </>
  );
};

export default Page;
