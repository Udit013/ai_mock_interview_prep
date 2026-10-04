/**
 * Shared limits for Gemini calls.
 *
 * Without a timeout a stalled model call holds the serverless function open
 * until the platform kills it, and the user sees a generic 504 instead of our
 * own error handling. Aborting first keeps failures inside our try/catch.
 */

/** Upper bound for one model call, including the SDK's internal retries. */
export const AI_CALL_TIMEOUT_MS = 45_000;

// Routes and pages that call Gemini declare `export const maxDuration = 60`
// (a literal, because Next reads it statically). Keep this timeout below that
// so our own error handling runs first; 60 s is the free Hobby plan ceiling.

/** Fresh abort signal for a single model call. */
export function aiAbortSignal(ms: number = AI_CALL_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}
