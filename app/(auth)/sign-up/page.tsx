import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Create your account",
  alternates: { canonical: "/sign-up" },
};

const Page = () => <AuthForm type="sign-up" />;

export default Page;
