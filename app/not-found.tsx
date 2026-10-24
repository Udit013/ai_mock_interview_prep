import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

const NotFound = () => (
  <main
    id="main-content"
    className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
  >
    <Image src="/logo.svg" alt="" width={56} height={48} priority />
    <p className="eyebrow">Error 404</p>
    <h1 className="page-title">We couldn&apos;t find that page</h1>
    <p className="text-light-400">
      The link may be broken, or the interview may have been removed. Head back
      and pick up where you left off.
    </p>
    <div className="flex flex-wrap justify-center gap-3">
      <Button asChild className="btn-primary">
        <Link href="/">Back to dashboard</Link>
      </Button>
      <Button asChild className="btn-secondary">
        <Link href="/interview">Start a new interview</Link>
      </Button>
    </div>
  </main>
);

export default NotFound;
