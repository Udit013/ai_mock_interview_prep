import { NextResponse, type NextRequest } from "next/server";
import { pageCsp } from "@/lib/security/csp";

/**
 * Per-request CSP nonce. Next.js reads the policy from the *request* headers
 * and stamps the nonce onto its own scripts; app/layout.tsx reads `x-nonce`
 * for the inline theme script. Runs at the edge on page requests only.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = pageCsp({ nonce, dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes, build assets, the runner workers (own CSP),
      // or generated metadata files.
      source:
        "/((?!api|_next/static|_next/image|runner|favicon.ico|icon.svg|apple-icon.png|opengraph-image|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
