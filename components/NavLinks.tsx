"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard", short: null, exact: true },
  { href: "/interview", label: "New interview", short: "New", exact: true },
  { href: "/resume", label: "Résumé Coach", short: "Résumé", exact: false },
] as const;

/** Header links with a visible, announced current-page state. */
const NavLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map(({ href, label, short, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            // The dashboard link is redundant with the logo on phones.
            className={cn("nav-link", !short && "max-sm:hidden", active && "nav-link-active")}
          >
            {short ? (
              <>
                <span className="sm:hidden">{short}</span>
                <span className="max-sm:hidden">{label}</span>
              </>
            ) : (
              label
            )}
          </Link>
        );
      })}
    </>
  );
};

export default NavLinks;
