import { describe, it, expect } from "vitest";
import {
  postInterviewTurn,
  describeTurnFailure,
} from "@/lib/interview/turn-client";

const respond = (status: number, body: unknown = {}) =>
  (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

describe("postInterviewTurn", () => {
  it("returns the reply on success", async () => {
    const result = await postInterviewTurn(
      {},
      { fetchImpl: respond(200, { aiResponse: "Next question.", isFinished: false }) }
    );
    expect(result).toEqual({
      kind: "ok",
      data: { aiResponse: "Next question.", isFinished: false },
    });
  });

  it("maps 429 and 401 to their own outcomes", async () => {
    expect(await postInterviewTurn({}, { fetchImpl: respond(429) })).toEqual({
      kind: "rate_limited",
    });
    expect(await postInterviewTurn({}, { fetchImpl: respond(401) })).toEqual({
      kind: "unauthorized",
    });
  });

  it("treats server errors as retryable failures", async () => {
    expect(await postInterviewTurn({}, { fetchImpl: respond(500) })).toEqual({
      kind: "failed",
      reason: "server",
    });
  });

  it("rejects a success response with no speech", async () => {
    for (const body of [{}, { aiResponse: "" }, { aiResponse: "   " }, null]) {
      expect(
        await postInterviewTurn({}, { fetchImpl: respond(200, body) })
      ).toEqual({ kind: "failed", reason: "server" });
    }
  });

  it("reports a dropped connection as a network failure", async () => {
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await postInterviewTurn({}, { fetchImpl: offline })).toEqual({
      kind: "failed",
      reason: "network",
    });
  });

  it("aborts a hung request and reports a timeout", async () => {
    let aborted = false;
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as unknown as typeof fetch;

    const started = Date.now();
    const result = await postInterviewTurn({}, { fetchImpl: hang, timeoutMs: 50 });
    expect(result).toEqual({ kind: "failed", reason: "timeout" });
    expect(aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("sends the body as JSON to the respond route", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const spy = (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ aiResponse: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;
    await postInterviewTurn({ userAnswer: "hi" }, { fetchImpl: spy });
    expect(seen!.url).toBe("/api/interview/respond");
    expect(seen!.init?.method).toBe("POST");
    expect(JSON.parse(String(seen!.init?.body))).toEqual({ userAnswer: "hi" });
  });
});

describe("describeTurnFailure", () => {
  it("always tells the candidate their answer is kept", () => {
    for (const reason of ["timeout", "network", "server"] as const) {
      expect(describeTurnFailure(reason)).toMatch(/answer is still/i);
    }
  });
});
