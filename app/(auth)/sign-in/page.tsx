import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/sign-in" },
};

const Page = () => <AuthForm type="sign-in" />;

export default Page;
