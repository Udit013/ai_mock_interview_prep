import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/actions/auth.action";
import {
  getInterviewById,
  getFeedbackByInterviewId,
} from "@/lib/data/interview.data";
import ReplayPlayer from "@/components/ReplayPlayer";
import { Button } from "@/components/ui/button";

const Page = async ({ params }: RouteParams) => {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [interview, feedback] = await Promise.all([
    getInterviewById(id),
    getFeedbackByInterviewId({ interviewId: id, userId: user.id }),
  ]);

  if (!interview) redirect("/");
  // Replays contain the full transcript — always owner-only.
  if (interview.userId !== user.id) redirect("/");
  if (!feedback?.transcript?.length) redirect(`/interview/${id}/feedback`);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <h2 className="capitalize">{interview.role} Interview — Replay</h2>
        <Button asChild className="btn-secondary">
          <Link href={`/interview/${id}/feedback`}>← Back to Feedback</Link>
        </Button>
      </div>

      <ReplayPlayer
        transcript={feedback.transcript}
        userName={user.name}
        finalCode={feedback.finalCode}
      />
    </section>
  );
};

export default Page;
