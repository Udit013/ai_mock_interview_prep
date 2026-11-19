import { JS_WORKER_SOURCE } from "@/lib/runner/worker-sources";

// Built once at deploy time and served as a static file. Its narrow CSP is
// attached in next.config.ts (headers for /runner/*).
export const dynamic = "force-static";

export function GET() {
  return new Response(JS_WORKER_SOURCE, {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
}
