import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dayjs from "dayjs";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewById,
  getFeedbackByInterviewId,
} from "@/lib/actions/interview.action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Page = async ({ params }: RouteParams) => {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [interview, feedback] = await Promise.all([
    getInterviewById(id),
    getFeedbackByInterviewId({ interviewId: id, userId: user.id }),
  ]);

  if (!interview) redirect("/");
  if (!feedback) redirect(`/interview/${id}`);

  const formattedDate = dayjs(feedback.createdAt).format("MMMM D, YYYY [at] h:mm A");

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-success-100";
    if (score >= 60) return "text-yellow-400";
    return "text-destructive-100";
  };

  return (
    <section className="section-feedback">
      <div className="flex flex-row justify-center">
        <h2>Interview Feedback</h2>
      </div>

      <div className="flex flex-row justify-center">
        <div className="flex flex-row gap-5 items-center">
          <div className="flex flex-row gap-2 items-center">
            <Image src="/star.svg" alt="star" width={22} height={22} />
            <p>
              Overall Score:{" "}
              <span className={cn("font-bold text-lg", scoreColor(feedback.totalScore))}>
                {feedback.totalScore}/100
              </span>
            </p>
          </div>

          <div className="flex flex-row gap-2 items-center">
            <Image src="/calendar.svg" alt="calendar" width={22} height={22} />
            <p>{formattedDate}</p>
          </div>
        </div>
      </div>

      <hr className="border-dark-300" />

      <section>
        <h3>Breakdown by Category</h3>
        <div className="flex flex-col gap-4 mt-4">
          {feedback.categoryScores.map(({ name, score, comment }) => (
            <div key={name} className="flex flex-col gap-2">
              <div className="flex flex-row justify-between items-center">
                <p className="font-semibold">{name}</p>
                <p className={cn("font-bold", scoreColor(score))}>
                  {score}/100
                </p>
              </div>
              <div className="w-full bg-dark-300 rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    score >= 80
                      ? "bg-success-100"
                      : score >= 60
                      ? "bg-yellow-400"
                      : "bg-destructive-100"
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="text-light-400 text-sm">{comment}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-dark-300" />

      <section className="flex flex-col gap-4">
        <h3>Strengths</h3>
        <ul className="flex flex-col gap-2">
          {feedback.strengths.map((strength, i) => (
            <li key={i} className="flex flex-row gap-2 items-start">
              <span className="text-success-100 mt-1">✓</span>
              <p>{strength}</p>
            </li>
          ))}
        </ul>
      </section>

      <hr className="border-dark-300" />

      <section className="flex flex-col gap-4">
        <h3>Areas for Improvement</h3>
        <ul className="flex flex-col gap-2">
          {feedback.areasForImprovement.map((area, i) => (
            <li key={i} className="flex flex-row gap-2 items-start">
              <span className="text-destructive-100 mt-1">→</span>
              <p>{area}</p>
            </li>
          ))}
        </ul>
      </section>

      <hr className="border-dark-300" />

      <section className="flex flex-col gap-4">
        <h3>Final Assessment</h3>
        <p className="text-light-400">{feedback.finalAssessment}</p>
      </section>

      <div className="buttons">
        <Button asChild className="btn-secondary flex-1">
          <Link href="/">
            <Image src="/logo.svg" alt="home" width={20} height={20} />
            Back to Dashboard
          </Link>
        </Button>

        <Button asChild className="btn-primary flex-1">
          <Link href={`/interview/${id}`}>
            <Image src="/user-avatar.png" alt="retry" width={20} height={20} />
            Retake Interview
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default Page;
