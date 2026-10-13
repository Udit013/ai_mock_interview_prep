import React from "react";
import type { Metadata } from "next";
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
} from "@/lib/data/interview.data";
import { computeProgress } from "@/lib/analytics/progress";

export const metadata: Metadata = { title: "Dashboard" };

const Page = async () => {
  const user = await getCurrentUser();

  const [userInterviews, latestInterviews, userFeedback] = await Promise.all([
    getInterviewsByUserId(user?.id ?? ""),
    getLatestInterviews({ userId: user?.id ?? "", limit: 20 }),
    getFeedbackByUserId(user?.id ?? ""),
  ]);

  // Derived from the feedback we already fetched — previously this called
  // getUserProgress(), which re-queried the entire feedback collection.
  const progress = computeProgress(userFeedback);

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
          <span className="eyebrow">AI interview coach</span>
          <h1 className="hero-title">
            Get interview-ready with AI-powered practice &amp; feedback
          </h1>
          <p className="text-lg text-light-100/90">
            Adaptive voice interviews, live coding rounds and detailed scoring
            — practice on real questions and see exactly what to improve.
          </p>
          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">Start an Interview</Link>
          </Button>
        </div>

        <Image
          src="/robot.png"
          alt=""
          width={400}
          height={400}
          priority
          className="max-sm:hidden float-slow drop-shadow-[0_20px_60px_rgba(202,197,254,0.25)]"
        />
      </section>

      {progress.totalInterviews > 0 && (
        <div>
          <ProgressOverview progress={progress} />
        </div>
      )}

      <section className="flex flex-col gap-6">
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
                coverImage={interview.coverImage}
                feedback={feedbackByInterview.get(interview.id) ?? null}
                visibility={interview.visibility ?? "public"}
              />
            ))
          ) : (
            <p className="empty-state">
              You haven&apos;t taken any interviews yet.{" "}
              <Link href="/interview" className="text-primary-200 font-bold underline-offset-4 hover:underline">
                Start one now!
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-6">
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
                coverImage={interview.coverImage}
              />
            ))
          ) : (
            <p className="empty-state">
              No interviews available yet. Be the first to create one!
            </p>
          )}
        </div>
      </section>
    </>
  );
};

export default Page;
