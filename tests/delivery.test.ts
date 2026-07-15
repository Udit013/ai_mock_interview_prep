import { describe, it, expect } from "vitest";
import {
  deliverySignalsSchema,
  codeSubmissionSchema,
} from "@/lib/ai/adaptive";

describe("deliverySignalsSchema", () => {
  const valid = {
    hesitationSeconds: 4.2,
    answerSeconds: 31.5,
    wordCount: 84,
    fillerCount: 3,
  };

  it("accepts a realistic payload", () => {
    expect(deliverySignalsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects negative and absurd values (bounded input)", () => {
    expect(
      deliverySignalsSchema.safeParse({ ...valid, hesitationSeconds: -1 })
        .success
    ).toBe(false);
    expect(
      deliverySignalsSchema.safeParse({ ...valid, answerSeconds: 10_000 })
        .success
    ).toBe(false);
    expect(
      deliverySignalsSchema.safeParse({ ...valid, wordCount: 999_999 }).success
    ).toBe(false);
  });

  it("rejects non-integer counts", () => {
    expect(
      deliverySignalsSchema.safeParse({ ...valid, fillerCount: 2.5 }).success
    ).toBe(false);
  });
});

describe("codeSubmissionSchema", () => {
  it("accepts supported languages within the size cap", () => {
    expect(
      codeSubmissionSchema.safeParse({
        language: "python",
        code: "def two_sum(nums, target): ...",
      }).success
    ).toBe(true);
  });

  it("rejects unsupported languages and oversized code", () => {
    expect(
      codeSubmissionSchema.safeParse({ language: "cobol", code: "x" }).success
    ).toBe(false);
    expect(
      codeSubmissionSchema.safeParse({
        language: "javascript",
        code: "x".repeat(20_001),
      }).success
    ).toBe(false);
  });
});
