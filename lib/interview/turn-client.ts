/**
 * Browser-side call to `/api/interview/respond`, reduced to a small set of
 * outcomes the interview UI can act on.
 *
 * Kept free of React so the timeout and error mapping can be unit tested.
 */

/** Longer than the server's own 45 s model timeout, so its error wins. */
export const TURN_TIMEOUT_MS = 50_000;

export interface TurnResponse {
  aiResponse: string;
  interviewState?: unknown;
  exchangeCount?: number;
  activeQuestionIndex?: number;
  isFinished?: boolean;
}

export type TurnResult =
  | { kind: "ok"; data: TurnResponse }
  | { kind: "rate_limited" }
  | { kind: "unauthorized" }
  /** Retryable: the answer was not processed and can be sent again. */
  | { kind: "failed"; reason: "timeout" | "network" | "server" };

export async function postInterviewTurn(
  body: unknown,
  {
    timeoutMs = TURN_TIMEOUT_MS,
    fetchImpl = fetch,
  }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<TurnResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetchImpl("/api/interview/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 429) return { kind: "rate_limited" };
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) return { kind: "failed", reason: "server" };

    const data = (await res.json()) as Partial<TurnResponse> | null;
    // A reply without speech would leave the candidate waiting in silence.
    if (!data || typeof data.aiResponse !== "string" || !data.aiResponse.trim()) {
      return { kind: "failed", reason: "server" };
    }
    return { kind: "ok", data: data as TurnResponse };
  } catch {
    return { kind: "failed", reason: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/** What to tell the candidate when a turn can be retried. */
export function describeTurnFailure(
  reason: "timeout" | "network" | "server"
): string {
  switch (reason) {
    case "timeout":
      return "The interviewer is taking too long to respond. Your answer is still in the box — press Send to try again.";
    case "network":
      return "Couldn't reach the interviewer. Check your connection — your answer is still in the box, press Send to retry.";
    case "server":
      return "The interviewer hit a problem. Your answer is still in the box — press Send to try again.";
  }
}
