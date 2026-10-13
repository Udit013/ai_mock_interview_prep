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
 * True when trying another model could help: quota/rate exhaustion (429) or a
 * model id that no longer exists (404). Timeouts and bad requests are not
 * retried on another model — they'd fail the same way.
 */
export function shouldTryNextModel(error: unknown): boolean {
  const candidates: unknown[] = [error];
  // The AI SDK wraps the final provider error in a RetryError.
  const last = (error as { lastError?: unknown })?.lastError;
  if (last) candidates.push(last);

  return candidates.some((e) => {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 429 || status === 404) return true;
    const message = String((e as { message?: string })?.message ?? "");
    return /RESOURCE_EXHAUSTED|quota|rate limit|not found for API version|is not found/i.test(
      message
    );
  });
}

/**
 * Run `call` with each model in the task's chain until one succeeds.
 * Non-quota errors are rethrown immediately.
 */
export async function withModelFallback<T>(
  task: ModelTask,
  call: (model: ReturnType<typeof google>, modelId: string) => Promise<T>,
  { chain = modelChain(task), createModel = google } = {} as {
    chain?: string[];
    createModel?: (id: string) => ReturnType<typeof google>;
  }
): Promise<T> {
  let lastError: unknown = new Error("No Gemini model configured.");
  for (const [i, id] of chain.entries()) {
    try {
      return await call(createModel(id), id);
    } catch (error) {
      lastError = error;
      const hasNext = i < chain.length - 1;
      if (!hasNext || !shouldTryNextModel(error)) throw error;
      console.warn(`Gemini model "${id}" unavailable (quota/retired); trying "${chain[i + 1]}".`);
    }
  }
  throw lastError;
}

/**
 * SDK retries per model. One retry absorbs a brief per-minute spike; more is
 * wasted time when the daily quota is gone, since the next model takes over.
 */
export const MODEL_MAX_RETRIES = 1;
