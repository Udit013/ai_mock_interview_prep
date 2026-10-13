import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_MODELS,
  modelChain,
  shouldTryNextModel,
  withModelFallback,
} from "@/lib/ai/models";

describe("modelChain", () => {
  it("uses the free-tier defaults", () => {
    expect(modelChain("interview", {})).toEqual([
      DEFAULT_MODELS.primary,
      DEFAULT_MODELS.fallback,
    ]);
    // No quality model by default: the fast Lite chain serves everything.
    expect(DEFAULT_MODELS.quality).toBeNull();
    expect(modelChain("quality", {})).toEqual([
      DEFAULT_MODELS.primary,
      DEFAULT_MODELS.fallback,
    ]);
  });

  it("honours environment overrides", () => {
    expect(
      modelChain("quality", {
        GEMINI_MODEL: "model-a",
        GEMINI_FALLBACK_MODEL: "model-b",
        GEMINI_QUALITY_MODEL: "model-q",
      })
    ).toEqual(["model-q", "model-a", "model-b"]);
  });

  it("lets a slot be disabled with 'none' and treats blanks as unset", () => {
    expect(
      modelChain("quality", { GEMINI_QUALITY_MODEL: "none", GEMINI_FALLBACK_MODEL: "NONE" })
    ).toEqual([DEFAULT_MODELS.primary]);
    // The main model can't be disabled — there'd be nothing left to call.
    expect(modelChain("interview", { GEMINI_MODEL: "none" })[0]).toBe(
      DEFAULT_MODELS.primary
    );
    expect(modelChain("interview", { GEMINI_MODEL: "  " })[0]).toBe(
      DEFAULT_MODELS.primary
    );
  });

  it("never lists the same model twice", () => {
    expect(
      modelChain("quality", { GEMINI_MODEL: "same", GEMINI_QUALITY_MODEL: "same" })
    ).toEqual(["same", DEFAULT_MODELS.fallback]);
  });
});

describe("shouldTryNextModel", () => {
  it("recognises quota exhaustion, including the SDK's RetryError wrapper", () => {
    expect(shouldTryNextModel({ statusCode: 429 })).toBe(true);
    // Shape observed from the AI SDK when the free-tier daily quota ran out.
    expect(
      shouldTryNextModel({
        name: "AI_RetryError",
        reason: "maxRetriesExceeded",
        lastError: { statusCode: 429, message: "You exceeded your current quota" },
      })
    ).toBe(true);
    expect(shouldTryNextModel(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
  });

  it("recognises a retired or unknown model id", () => {
    expect(shouldTryNextModel({ statusCode: 404 })).toBe(true);
  });

  it("does not switch models for timeouts or bad requests", () => {
    expect(shouldTryNextModel(new DOMException("timed out", "TimeoutError"))).toBe(false);
    expect(shouldTryNextModel({ statusCode: 400, message: "Invalid schema" })).toBe(false);
    expect(shouldTryNextModel(undefined)).toBe(false);
  });
});

describe("withModelFallback", () => {
  const createModel = (id: string) => ({ id }) as never;

  it("returns the first model's result when it works", async () => {
    const call = vi.fn(async (_m: unknown, id: string) => `ok:${id}`);
    await expect(
      withModelFallback("interview", call, { chain: ["a", "b"], createModel })
    ).resolves.toBe("ok:a");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("moves to the next model when one is out of quota", async () => {
    const call = vi.fn(async (_m: unknown, id: string) => {
      if (id === "a") throw { statusCode: 429, message: "quota" };
      return `ok:${id}`;
    });
    await expect(
      withModelFallback("interview", call, { chain: ["a", "b"], createModel })
    ).resolves.toBe("ok:b");
  });

  it("rethrows non-quota errors without trying other models", async () => {
    const call = vi.fn(async () => {
      throw new Error("bad request");
    });
    await expect(
      withModelFallback("interview", call, { chain: ["a", "b"], createModel })
    ).rejects.toThrow("bad request");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("surfaces the last error when every model is exhausted", async () => {
    const call = vi.fn(async (_m: unknown, id: string) => {
      throw { statusCode: 429, message: `quota ${id}` };
    });
    await expect(
      withModelFallback("interview", call, { chain: ["a", "b"], createModel })
    ).rejects.toMatchObject({ message: "quota b" });
    expect(call).toHaveBeenCalledTimes(2);
  });
});
