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
import {
  countArchived,
  filterLibrary,
  parseLibraryView,
  summarizeCollections,
} from "@/lib/interview/library";

export const metadata: Metadata = { title: "Dashboard" };

const Page = async ({ searchParams }: RouteParams) => {
  const user = await getCurrentUser();
  // Library filter lives in the URL (?collection=… / ?view=archived) so views
  // are linkable and the page stays a server component.
  const view = parseLibraryView((await searchParams) ?? {});

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

  const collections = summarizeCollections(userInterviews);
  const archivedCount = countArchived(userInterviews);
  const visibleInterviews = filterLibrary(userInterviews, view);
  const collectionNames = collections.map((c) => c.name);
  const activeCount = filterLibrary(userInterviews, { kind: "all" }).length;
  const showFilters = collections.length > 0 || archivedCount > 0;

  const hasUserInterviews = userInterviews.length > 0;
  const hasLatestInterviews = latestInterviews.length > 0;

  return (
    <>
      <section className="card-cta">
        <div className="flex flex-col gap-6 max-w-lg flex-1 min-w-0">
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
          className="max-md:hidden shrink-0 w-[clamp(220px,30vw,400px)] h-auto float-slow drop-shadow-[0_20px_60px_rgba(202,197,254,0.25)]"
        />
      </section>

      {progress.totalInterviews > 0 && (
        <div>
          <ProgressOverview progress={progress} />
        </div>
      )}

      <section className="flex flex-col gap-6">
        <h2 id="your-interviews">Your Interviews</h2>

        {showFilters && (
          <nav aria-label="Filter your interviews" className="-mt-2 flex flex-wrap gap-2">
            <Link
              href="/#your-interviews"
              scroll={false}
              className="collection-chip"
              aria-current={view.kind === "all" ? "page" : undefined}
            >
              All <span className="chip-count">{activeCount}</span>
            </Link>
            {collections.map((c) => (
              <Link
                key={c.name}
                href={`/?collection=${encodeURIComponent(c.name)}#your-interviews`}
                scroll={false}
                className="collection-chip"
                aria-current={
                  view.kind === "collection" &&
                  view.name.toLowerCase() === c.name.toLowerCase()
                    ? "page"
                    : undefined
                }
              >
                {c.name} <span className="chip-count">{c.count}</span>
              </Link>
            ))}
            {archivedCount > 0 && (
              <Link
                href="/?view=archived#your-interviews"
                scroll={false}
                className="collection-chip"
                aria-current={view.kind === "archived" ? "page" : undefined}
              >
                Archived <span className="chip-count">{archivedCount}</span>
              </Link>
            )}
          </nav>
        )}

        <div className="interviews-section">
          {visibleInterviews.length > 0 ? (
            visibleInterviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                userId={user?.id}
                interviewId={interview.id}
                role={interview.role}
                type={interview.type}
                techstack={interview.techstack}
                createdAt={interview.createdAt}
                companyName={interview.companyName}
                feedback={feedbackByInterview.get(interview.id) ?? null}
                visibility={interview.visibility ?? "public"}
                isOwner
                archived={interview.archived}
                collection={interview.collection}
                collections={collectionNames}
              />
            ))
          ) : hasUserInterviews ? (
            <div className="empty-state flex flex-col items-center gap-3">
              <p>
                {view.kind === "archived"
                  ? "Nothing archived."
                  : view.kind === "collection"
                  ? `No active interviews in "${view.name}".`
                  : "All your interviews are archived."}
              </p>
              <Link
                href="/#your-interviews"
                scroll={false}
                className="text-primary-200 font-semibold underline-offset-4 hover:underline"
              >
                Show all interviews
              </Link>
            </div>
          ) : (
            <div className="empty-state flex flex-col items-center gap-4">
              <p>You haven&apos;t taken any interviews yet.</p>
              <Button asChild className="btn-primary">
                <Link href="/interview">Create your first interview</Link>
              </Button>
            </div>
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
                companyName={interview.companyName}
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
