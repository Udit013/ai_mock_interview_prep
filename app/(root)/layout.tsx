import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { isAuthenticated, signOut } from "@/lib/actions/auth.action";

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");

  return (
    <div className="root-layout">
      <nav className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Logo" width={38} height={32} />
          <h2 className="text-primary-100">PrepWise</h2>
        </Link>

        <form
          action={async () => {
            "use server";
            await signOut();
            redirect("/sign-in");
          }}
        >
          <button
            type="submit"
            className="text-light-400 hover:text-primary-100 transition-colors text-sm cursor-pointer"
          >
            Sign Out
          </button>
        </form>
      </nav>

      {children}
    </div>
  );
};

export default RootLayout;
