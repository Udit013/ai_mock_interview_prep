import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import InterviewCard from "@/components/InterviewCard";
import ProgressOverview from "@/components/dashboard/ProgressOverview";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewsByUserId,
  getLatestInterviews,
  getFeedbackByUserId,
} from "@/lib/actions/interview.action";
import { getUserProgress } from "@/lib/actions/analytics.action";

const Page = async () => {
  const user = await getCurrentUser();

  const [userInterviews, latestInterviews, userFeedback, progress] =
    await Promise.all([
      getInterviewsByUserId(user?.id ?? ""),
      getLatestInterviews({ userId: user?.id ?? "", limit: 20 }),
      getFeedbackByUserId(user?.id ?? ""),
      getUserProgress(user?.id ?? ""),
    ]);

  // Map each of the user's interviews to its feedback (fixes cards always
  // showing "not taken yet").
  const feedbackByInterview = new Map(
    userFeedback.map((f) => [f.interviewId, f])
  );

  const hasUserInterviews = userInterviews.length > 0;
  const hasLatestInterviews = latestInterviews.length > 0;

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg">
          <h2>Get Interview-Ready with AI-Powered Practice &amp; Feedback</h2>
          <p className="text-lg">
            Practice on real interview questions &amp; get instant feedback
          </p>
          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt="PrepWise robot"
          width={400}
          height={400}
          className="max-sm:hidden"
        />
      </section>

      {progress.totalInterviews > 0 && (
        <div className="mt-8">
          <ProgressOverview progress={progress} />
        </div>
      )}

      <section className="flex flex-col gap-6 mt-8">
        <h2>Your Interviews</h2>

        <div className="interviews-section">
          {hasUserInterviews ? (
            userInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user?.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                feedback={feedbackByInterview.get(interview.id) ?? null}
                visibility={interview.visibility ?? "public"}
              />
            ))
          ) : (
            <p className="text-light-400">
              You haven&apos;t taken any interviews yet.{" "}
              <Link href="/interview" className="text-user-primary font-bold">
                Start one now!
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-6 mt-8">
        <h2>Take an Interview</h2>

        <div className="interviews-section">
          {hasLatestInterviews ? (
            latestInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user?.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
              />
            ))
          ) : (
            <p className="text-light-400">
              No interviews available yet. Be the first to create one!
            </p>
          )}
        </div>
      </section>
    </>
  );
};

export default Page;
