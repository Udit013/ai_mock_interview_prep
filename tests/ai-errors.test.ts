import { describe, it, expect } from "vitest";
import { APICallError, RetryError } from "ai";
import {
  classifyAiError,
  userMessageFor,
  backoffDelay,
  statusFor,
} from "@/lib/ai/errors";
import { withModelFallback } from "@/lib/ai/models";

const URL = "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent";

/** Gemini's real overload response, as the AI SDK surfaces it. */
const overloaded = () =>
  new APICallError({
    message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    url: URL,
    requestBodyValues: {},
    statusCode: 503,
    responseBody: '{"error":{"code":503,"status":"UNAVAILABLE"}}',
    isRetryable: true,
  });

const quota = () =>
  new APICallError({
    message: "You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests, project 439771822604",
    url: URL,
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: true,
  });

const badRequest = () =>
  new APICallError({ message: "Invalid JSON schema", url: URL, requestBodyValues: {}, statusCode: 400, isRetryable: false });

/** The exact wrapper behind the reported "Failed after 2 attempts…" toast. */
const reported = () =>
  new RetryError({
    message: "Failed after 2 attempts. Last error: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    reason: "maxRetriesExceeded",
    errors: [overloaded(), overloaded()],
  });

describe("classifyAiError", () => {
  it("recognises the reported Résumé Coach failure as a temporary overload", () => {
    expect(classifyAiError(reported())).toBe("unavailable");
    expect(classifyAiError(overloaded())).toBe("unavailable");
  });

  it("classifies quota, retired models, timeouts and bad requests", () => {
    expect(classifyAiError(quota())).toBe("quota");
    expect(classifyAiError({ statusCode: 404, message: "models/x is not found" })).toBe("not_found");
    expect(classifyAiError(new DOMException("The operation was aborted due to timeout", "TimeoutError"))).toBe("timeout");
    expect(classifyAiError(badRequest())).toBe("unknown");
    expect(classifyAiError(new TypeError("fetch failed"))).toBe("unavailable");
    expect(classifyAiError({ name: "AI_NoObjectGeneratedError", message: "No object generated" })).toBe("invalid_output");
    expect(classifyAiError(undefined)).toBe("unknown");
  });
});

describe("userMessageFor", () => {
  it("never exposes provider text, attempt counts or project ids", () => {
    for (const e of [reported(), overloaded(), quota(), badRequest(), new Error("secret internals")]) {
      const msg = userMessageFor(e, "Résumé coaching");
      expect(msg).not.toMatch(/Failed after|attempts|high demand|quota exceeded|439771822604|generativelanguage|JSON schema|internals/i);
      expect(msg.startsWith("Résumé coaching")).toBe(true);
    }
  });

  it("tells the user what to do next", () => {
    expect(userMessageFor(reported(), "Résumé coaching")).toMatch(/busy.*try again in a minute/i);
    expect(userMessageFor(quota(), "Feedback")).toMatch(/tomorrow/i);
  });

  it("maps to retry-friendly HTTP statuses", () => {
    expect(statusFor(reported())).toBe(503);
    expect(statusFor(badRequest())).toBe(500);
  });
});

describe("backoffDelay (exponential with full jitter)", () => {
  it("stays within the growing, capped window", () => {
    expect(backoffDelay(0, { random: () => 1 })).toBe(500);
    expect(backoffDelay(1, { random: () => 1 })).toBe(1000);
    expect(backoffDelay(10, { random: () => 1 })).toBe(4000);
    expect(backoffDelay(3, { random: () => 0 })).toBe(0);
    for (let i = 0; i < 200; i++) {
      const d = backoffDelay(2);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(2000);
    }
  });
});

describe("withModelFallback — failure simulations", () => {
  const createModel = (id: string) => ({ id }) as never;
  const harness = (outcomes: Record<string, (() => unknown)[]>) => {
    const calls: string[] = [];
    const waits: number[] = [];
    let clock = 0;
    const call = async (_m: unknown, id: string) => {
      calls.push(id);
      const next = outcomes[id]?.shift();
      const result = next?.();
      if (result instanceof Error || (result && typeof result === "object" && "statusCode" in result)) throw result;
      return `ok:${id}`;
    };
    const opts = {
      chain: Object.keys(outcomes),
      createModel,
      random: () => 0.5,
      wait: async (ms: number) => {
        waits.push(ms);
        clock += ms;
      },
      now: () => clock,
    };
    return { call, calls, waits, opts };
  };

  it("rides out a brief overload on the same model with backoff", async () => {
    const h = harness({ primary: [overloaded, overloaded, () => "ok"], fallback: [] });
    await expect(withModelFallback("interview", h.call, h.opts)).resolves.toBe("ok:primary");
    expect(h.calls).toEqual(["primary", "primary", "primary"]);
    expect(h.waits).toEqual([250, 500]); // jittered exponential
  });

  it("fails over when the primary stays overloaded (the reported bug)", async () => {
    const h = harness({ primary: [reported, reported, reported], fallback: [() => "ok"] });
    await expect(withModelFallback("interview", h.call, h.opts)).resolves.toBe("ok:fallback");
    expect(h.calls).toEqual(["primary", "primary", "primary", "fallback"]);
  });

  it("fails over immediately on quota, without waiting", async () => {
    const h = harness({ primary: [quota], fallback: [() => "ok"] });
    await expect(withModelFallback("interview", h.call, h.opts)).resolves.toBe("ok:fallback");
    expect(h.waits).toEqual([]);
  });

  it("is bounded when every model is down: no infinite retries", async () => {
    const down = Array.from({ length: 10 }, () => overloaded);
    const h = harness({ primary: [...down], fallback: [...down] });
    await expect(withModelFallback("interview", h.call, h.opts)).rejects.toMatchObject({ statusCode: 503 });
    expect(h.calls).toHaveLength(6); // (2 retries + 1) × 2 models
  });

  it("skips the wait and fails over when there's no time to back off", async () => {
    const h = harness({ primary: [overloaded, overloaded, overloaded], fallback: [() => "ok"] });
    await expect(
      withModelFallback("interview", h.call, { ...h.opts, budgetMs: 100 })
    ).resolves.toBe("ok:fallback");
    expect(h.waits).toEqual([]);
    expect(h.calls).toEqual(["primary", "fallback"]);
  });

  it("stops entirely once the time budget is spent", async () => {
    let clock = 0;
    const calls: string[] = [];
    const slowFailure = async (_m: unknown, id: string) => {
      calls.push(id);
      clock += 200; // the failing call itself took 200 ms
      throw overloaded();
    };
    await expect(
      withModelFallback("interview", slowFailure, {
        chain: ["primary", "fallback"],
        createModel: (id: string) => ({ id }) as never,
        budgetMs: 100,
        now: () => clock,
        wait: async () => {},
      })
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(calls).toEqual(["primary"]);
  });

  it("does not retry or fail over on a bad request", async () => {
    const h = harness({ primary: [badRequest], fallback: [() => "ok"] });
    await expect(withModelFallback("interview", h.call, h.opts)).rejects.toMatchObject({ statusCode: 400 });
    expect(h.calls).toEqual(["primary"]);
  });
});
