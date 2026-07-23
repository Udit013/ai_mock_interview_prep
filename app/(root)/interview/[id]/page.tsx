import React from "react";
import { redirect } from "next/navigation";
import Image from "next/image";
import Agent from "@/components/Agent";
import CodingInterview from "@/components/CodingInterview";
import DisplayTechIcons from "@/components/DisplayTechIcons";
import { getCompanyMode } from "@/constants/companies";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewById,
  getFeedbackByInterviewId,
} from "@/lib/actions/interview.action";

const Page = async ({ params }: RouteParams) => {
  const { id } = await params;

  const [user, interview] = await Promise.all([
    getCurrentUser(),
    getInterviewById(id),
  ]);

  if (!user) redirect("/sign-in");
  if (!interview) redirect("/");
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
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dark-300 bg-dark-200/40 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <Image
            src="/robot.png"
            alt=""
            width={40}
            height={40}
            className="rounded-full object-cover size-10"
          />
          <div className="flex flex-col">
            <h3 className="capitalize leading-tight">
              {interview.role} Interview
            </h3>
            <p className="text-xs text-light-400 capitalize">
              {interview.level} level
              {company ? ` · ${company.name} style` : ""}
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
        />
      )}
    </>
  );
};

export default Page;
