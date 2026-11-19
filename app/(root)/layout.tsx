import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated, signOut } from "@/lib/actions/auth.action";
import NavLinks from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";
import { LogoMark } from "@/components/Logo";

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");

  return (
    <div className="root-layout">
      <header className="site-header">
        <nav
          aria-label="Main"
          className="flex items-center justify-between gap-4"
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg"
            aria-label="PrepWise home"
          >
            <LogoMark size={28} />
            <span className="text-fg text-lg font-semibold tracking-tight max-sm:hidden">
              PrepWise
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <NavLinks />
            <ThemeToggle />

            <form
              action={async () => {
                "use server";
                await signOut();
                redirect("/sign-in");
              }}
            >
              <button type="submit" className="nav-link" aria-label="Sign out">
                <span className="sm:hidden">Sign out</span>
                <span className="max-sm:hidden">Sign Out</span>
              </button>
            </form>
          </div>
        </nav>
      </header>

      <main id="main-content" className="flex flex-col gap-12">
        {children}
      </main>
    </div>
  );
};

export default RootLayout;
