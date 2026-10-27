import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { isAuthenticated, signOut } from "@/lib/actions/auth.action";
import NavLinks from "@/components/NavLinks";

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
            <Image src="/logo.svg" alt="" width={38} height={32} priority className="max-sm:w-8 h-auto" />
            <span className="text-primary-100 text-xl sm:text-2xl lg:text-3xl font-semibold">
              PrepWise
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <NavLinks />

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
