/**
 * One place that understands Gemini / AI SDK failures.
 *
 * Every AI call site maps errors through here, so that:
 *  - transient overloads ("This model is currently experiencing high demand",
 *    HTTP 503) are retried with backoff and then failed over to another model,
 *  - quota exhaustion and retired models fail over immediately,
 *  - and users only ever see a short, actionable message — never the raw
 *    provider text, which can include project ids and quota details.
 *
 * Pure (no SDK import) so it's unit-testable with realistic error shapes.
 */

export type AiErrorKind =
  /** 503/500/502/504, "overloaded", "high demand", dropped connection. */
  | "unavailable"
  /** 429 / RESOURCE_EXHAUSTED: this model's quota is used up. */
  | "quota"
  /** 404: the model id was retired or never existed. */
  | "not_found"
  /** Our own abort timeout fired. */
  | "timeout"
  /** The model answered, but not in a usable shape. */
  | "invalid_output"
  /** Anything else (bad request, auth, bugs): not worth retrying. */
  | "unknown";

type ErrorLike = {
  name?: string;
  message?: string;
  statusCode?: number;
  status?: number;
  code?: string;
  lastError?: unknown;
  errors?: unknown[];
  cause?: unknown;
  responseBody?: string;
};

/** The provider error underneath the SDK's RetryError wrapper, if any. */
function layers(error: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  const seen = new Set<unknown>();
  const visit = (e: unknown, depth: number) => {
    if (!e || typeof e !== "object" || seen.has(e) || depth > 4) return;
    seen.add(e);
    out.push(e as ErrorLike);
    const x = e as ErrorLike;
    visit(x.lastError, depth + 1);
    visit(x.cause, depth + 1);
  };
  visit(error, 0);
  return out;
}

export function classifyAiError(error: unknown): AiErrorKind {
  const all = layers(error);
  if (all.length === 0) return "unknown";

  const text = all
    .map((e) => `${e.name ?? ""} ${e.message ?? ""} ${e.code ?? ""} ${e.responseBody ?? ""}`)
    .join(" ");
  const statuses = all.map((e) => e.statusCode ?? e.status).filter((s): s is number => typeof s === "number");

  if (all.some((e) => e.name === "TimeoutError" || e.name === "AbortError") || /aborted due to timeout/i.test(text)) {
    return "timeout";
  }
  if (statuses.includes(429) || /RESOURCE_EXHAUSTED|exceeded your current quota|rate limit/i.test(text)) {
    return "quota";
  }
  if (statuses.includes(404) || /not found for API version|is not found|NOT_FOUND/i.test(text)) {
    return "not_found";
  }
  if (
    statuses.some((s) => s === 500 || s === 502 || s === 503 || s === 504) ||
    /UNAVAILABLE|overloaded|high demand|try again later|INTERNAL|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(text)
  ) {
    return "unavailable";
  }
  if (/NoObjectGenerated|TypeValidation|JSONParse|InvalidResponse/i.test(text)) {
    return "invalid_output";
  }
  return "unknown";
}

/** Worth another attempt on the same model after a short wait. */
export const isTransient = (kind: AiErrorKind) => kind === "unavailable";

/** Worth trying the next model in the chain. */
export const isFailoverable = (kind: AiErrorKind) =>
  kind === "unavailable" || kind === "quota" || kind === "not_found";

/**
 * Exponential backoff with full jitter: a random delay in [0, base·2^attempt],
 * capped. Jitter stops many clients retrying in lock-step against a model that
 * is already overloaded.
 */
export function backoffDelay(
  attempt: number,
  { baseMs = 500, capMs = 4000, random = Math.random } = {}
): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** Math.max(attempt, 0));
  return Math.round(random() * ceiling);
}

/** What the user sees. Short, honest, and says what to do next. */
export function userMessageFor(error: unknown, feature = "This"): string {
  switch (classifyAiError(error)) {
    case "unavailable":
      return `${feature} is temporarily unavailable because the AI service is busy. Please try again in a minute.`;
    case "quota":
      return `${feature} has hit today's free AI limit. Please try again tomorrow.`;
    case "timeout":
      return `${feature} took too long to respond. Please try again.`;
    case "invalid_output":
      return `${feature} returned an unexpected response. Please try again.`;
    case "not_found":
    case "unknown":
    default:
      return `${feature} isn't available right now. Please try again.`;
  }
}

/** HTTP status a route should return for an AI failure. */
export function statusFor(error: unknown): number {
  const kind = classifyAiError(error);
  if (kind === "quota") return 429;
  if (kind === "unavailable" || kind === "timeout") return 503;
  return 500;
}
