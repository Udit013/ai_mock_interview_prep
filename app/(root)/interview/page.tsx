import type { Metadata } from "next";
import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import InterviewForm from "@/components/InterviewForm";

export const metadata: Metadata = { title: "New interview" };

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <>
      <h1 className="page-title">Create a new interview</h1>
      <InterviewForm />
    </>
  );
};

export default Page;
