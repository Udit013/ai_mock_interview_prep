import React from "react";
import { redirect } from "next/navigation";
import Image from "next/image";
import Agent from "@/components/Agent";
import DisplayTechIcons from "@/components/DisplayTechIcons";
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

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user.id,
  });

  return (
    <>
      <div className="flex flex-row gap-4 justify-between">
        <div className="flex flex-row gap-4 items-center max-sm:flex-col">
          <div className="flex flex-row gap-4 items-center">
            <Image
              src="/robot.png"
              alt="cover"
              width={40}
              height={40}
              className="rounded-full object-cover size-[40px]"
            />
            <h3 className="capitalize">{interview.role} Interview</h3>
          </div>

          <DisplayTechIcons techStack={interview.techstack} />
        </div>

        <p className="bg-dark-200 px-4 py-2 rounded-lg h-fit capitalize">
          {interview.type}
        </p>
      </div>

      <Agent
        userName={user.name}
        userId={user.id}
        interviewId={id}
        feedbackId={feedback?.id}
        type="interview"
        questions={interview.questions}
      />
    </>
  );
};

export default Page;
