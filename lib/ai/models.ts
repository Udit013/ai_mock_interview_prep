/**
 * Which Gemini model each call uses, and what happens when one runs out.
 *
 * Free-tier quotas are per model, per project, per day (e.g. 20 requests for
 * the Flash models, 500 for the Flash-Lite ones). So instead of one hardcoded
 * model, every call walks a short chain: if a model is out of quota (or has
 * been retired), the next one is tried. Each model in the chain has its own
 * separate quota, so the chain multiplies daily capacity at no cost.
 *
 * Override any slot with an environment variable — no code change needed:
 *   GEMINI_MODEL           main model for everything      (default below)
 *   GEMINI_FALLBACK_MODEL  used when the main one is out  (set "none" to disable)
 *   GEMINI_QUALITY_MODEL   opt-in: preferred for question generation and
 *                          feedback, e.g. "gemini-3.8-flash" (unset by default)
 *
 * Why no quality model by default: the larger Flash models "think" before
 * answering. Measured on this project, gemini-3.8-flash took 7 s on a tiny
 * prompt and exceeded the 45 s timeout on the full question-generation
 * prompt, while gemini-3.5-flash-lite answered in ~1 s (2-2.5 s per live
 * interview turn) with 25x the free daily quota.
 */

import { google } from "@ai-sdk/google";
import {
  backoffDelay,
  classifyAiError,
  isFailoverable,
  isTransient,
} from "@/lib/ai/errors";

export const DEFAULT_MODELS: {
  primary: string;
  fallback: string | null;
  quality: string | null;
} = {
  primary: "gemini-3.5-flash-lite", // 500 requests/day on the free tier
  fallback: "gemini-3.1-flash-lite", // separate 500/day quota
  quality: null,
};

/**
 * `interview` — high-volume calls (live turns, résumé parsing/coaching).
 * `quality`   — once-per-interview calls (question generation, feedback).
 */
export type ModelTask = "interview" | "quality";

type Env = Record<string, string | undefined>;

function slot(env: Env, name: string, fallback: string | null): string | null {
  const value = env[name]?.trim();
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "none" ? null : value;
}

/** Ordered, de-duplicated list of model ids to try for a task. */
export function modelChain(task: ModelTask, env: Env = process.env): string[] {
  const primary = slot(env, "GEMINI_MODEL", DEFAULT_MODELS.primary) ?? DEFAULT_MODELS.primary;
  const fallback = slot(env, "GEMINI_FALLBACK_MODEL", DEFAULT_MODELS.fallback);
  const quality = slot(env, "GEMINI_QUALITY_MODEL", DEFAULT_MODELS.quality);

  const chain =
    task === "quality" ? [quality, primary, fallback] : [primary, fallback];
  const ids = chain.filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

/**
 * True when trying another model could help: the model is overloaded or
 * erroring (5xx), out of quota (429), or retired (404). Timeouts and bad
 * requests are not — they'd fail the same way on the next model.
 */
export function shouldTryNextModel(error: unknown): boolean {
  return isFailoverable(classifyAiError(error));
}

/** Retries on one model for a transient overload before moving on. */
export const TRANSIENT_RETRIES_PER_MODEL = 2;

/**
 * Total time the whole chain may spend, including backoff waits. Kept under
 * the routes' 60 s `maxDuration` so our own error handling always runs.
 */
export const FALLBACK_BUDGET_MS = 40_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run `call` against each model in the task's chain until one succeeds.
 *
 *  - Overloaded (503 "high demand") → back off with jitter and retry the same
 *    model up to TRANSIENT_RETRIES_PER_MODEL times, then fail over.
 *  - Quota (429) or retired (404) → fail over immediately.
 *  - Timeouts, bad output, bad requests → rethrow; the caller decides.
 *
 * Bounded: never more than (retries + 1) × models attempts, and never past
 * the time budget — so an outage costs a few seconds, not a stuck request.
 */
export async function withModelFallback<T>(
  task: ModelTask,
  call: (model: ReturnType<typeof google>, modelId: string) => Promise<T>,
  {
    chain = modelChain(task),
    createModel = google,
    budgetMs = FALLBACK_BUDGET_MS,
    retriesPerModel = TRANSIENT_RETRIES_PER_MODEL,
    wait = sleep,
    random = Math.random,
    now = Date.now,
  } = {} as {
    chain?: string[];
    createModel?: (id: string) => ReturnType<typeof google>;
    budgetMs?: number;
    retriesPerModel?: number;
    wait?: (ms: number) => Promise<unknown>;
    random?: () => number;
    now?: () => number;
  }
): Promise<T> {
  const deadline = now() + budgetMs;
  let lastError: unknown = new Error("No Gemini model configured.");

  for (const [i, id] of chain.entries()) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await call(createModel(id), id);
      } catch (error) {
        lastError = error;
        const kind = classifyAiError(error);
        if (!isFailoverable(kind)) throw error;

        if (isTransient(kind) && attempt < retriesPerModel) {
          const delay = backoffDelay(attempt, { random });
          if (now() + delay < deadline) {
            console.warn(`Gemini "${id}" busy (attempt ${attempt + 1}); retrying in ${delay} ms.`);
            await wait(delay);
            continue;
          }
        }
        break; // give up on this model
      }
    }
    const next = chain[i + 1];
    if (!next || now() >= deadline) break;
    console.warn(`Gemini "${id}" unavailable (${classifyAiError(lastError)}); failing over to "${next}".`);
  }
  throw lastError;
}

/**
 * SDK-level retries per call. Zero: the loop above owns retrying, with
 * backoff and failover — SDK retries on top would multiply attempts against
 * a model that is already overloaded.
 */
export const MODEL_MAX_RETRIES = 0;
