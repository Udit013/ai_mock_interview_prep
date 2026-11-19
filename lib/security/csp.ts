/**
 * Content-Security-Policy for PrepWise.
 *
 * Pages get a per-request nonce (middleware.ts) with 'strict-dynamic': only
 * scripts carrying the nonce — Next.js's own, plus the inline theme script —
 * may run, and they may load further scripts (Monaco from jsDelivr, Google's
 * sign-in helper). Injected markup can't execute: no nonce, no inline event
 * handlers, no eval.
 *
 * The code runner needs eval/WebAssembly, so it lives in same-origin workers
 * with their own policies (see lib/runner/worker-sources.ts), which keeps
 * 'unsafe-eval' off every page.
 */

/** Firebase Auth's sign-in helper is framed from here (firebase/client.ts). */
export const FIREBASE_AUTH_DOMAIN = "prepwise-d59e4.firebaseapp.com";
const JSDELIVR = "https://cdn.jsdelivr.net";

const join = (directives: Record<string, string[]>) =>
  Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");

export function pageCsp({ nonce, dev = false }: { nonce: string; dev?: boolean }): string {
  return join({
    "default-src": ["'self'"],
    // Host entries are a fallback for CSP2-only browsers; CSP3 browsers
    // ignore them because of 'strict-dynamic'. Dev needs eval for HMR.
    "script-src": [
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'self'",
      JSDELIVR,
      "https://apis.google.com",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // React style attributes and Monaco's injected <style> need inline styles.
    "style-src": ["'self'", "'unsafe-inline'", JSDELIVR],
    "img-src": ["'self'", "data:", "blob:", JSDELIVR, "https://*.googleusercontent.com"],
    "font-src": ["'self'", "data:", JSDELIVR],
    "connect-src": [
      "'self'",
      "https://*.googleapis.com", // Firebase Auth (identitytoolkit, securetoken)
      "https://apis.google.com",
      JSDELIVR,
      ...(dev ? ["ws:"] : []),
    ],
    "frame-src": [`https://${FIREBASE_AUTH_DOMAIN}`, "https://accounts.google.com", "https://apis.google.com"],
    // Same-origin code-runner workers; Monaco's language workers start as blob:.
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(dev ? {} : { "upgrade-insecure-requests": [] }),
  });
}

/** JavaScript sandbox: may eval the candidate's code, and nothing else — no network. */
export const JS_WORKER_CSP = join({
  "default-src": ["'none'"],
  "script-src": ["'unsafe-eval'"],
});

/** Python sandbox: Pyodide from its pinned CDN path, plus WebAssembly. */
export const PY_WORKER_CSP = join({
  "default-src": ["'none'"],
  "script-src": ["'unsafe-eval'", "'wasm-unsafe-eval'", `${JSDELIVR}/pyodide/`],
  "connect-src": [`${JSDELIVR}/pyodide/`],
});
