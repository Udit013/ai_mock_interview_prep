"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Catches render errors below the root layout and offers a way forward. */
const ErrorPage = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      <p className="eyebrow">Something went wrong</p>
      <h1 className="page-title">That didn&apos;t load as expected</h1>
      <p className="text-light-400" role="alert">
        An unexpected error interrupted this page. Your interviews and feedback
        are safe — try again, or return to the dashboard.
      </p>
      {error.digest && (
        <p className="text-xs text-light-400">Reference: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset} className="btn-primary">
          Try again
        </Button>
        <Button asChild className="btn-secondary">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
};

export default ErrorPage;
