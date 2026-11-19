import React from "react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";
  const hasLatestInterviews = latestInterviews.length > 0;

  return (
    <>
      <section className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="eyebrow">Dashboard</p>
          <h1 className="hero-title">
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
          <p className="text-base text-fg-muted">
            {progress.totalInterviews === 0
              ? "Run a realistic mock interview — voice, coding, or tailored to a job posting — and get scored, specific feedback in minutes."
              : progress.weakest
              ? `${progress.totalInterviews} interview${progress.totalInterviews === 1 ? "" : "s"} scored, averaging ${progress.averageScore}. Your next focus: ${progress.weakest.name}.`
              : `${progress.totalInterviews} interview${progress.totalInterviews === 1 ? "" : "s"} scored, averaging ${progress.averageScore}.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3 max-sm:flex-col">
          <Button asChild className="btn-primary max-sm:w-full">
            <Link href="/interview">New interview</Link>
          </Button>
          <Button asChild className="btn-secondary max-sm:w-full">
            <Link href="/resume">Résumé Coach</Link>
          </Button>
        </div>
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
