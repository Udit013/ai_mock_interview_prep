import { describe, it, expect } from "vitest";
import { isRunnable, RUNNABLE_LANGUAGES, runCode } from "@/lib/runner/code-runner";

describe("runnable language gating", () => {
  it("marks JavaScript and Python runnable", () => {
    expect(isRunnable("javascript")).toBe(true);
    expect(isRunnable("python")).toBe(true);
    expect(RUNNABLE_LANGUAGES).toEqual(["javascript", "python"]);
  });

  it("marks compiled languages non-runnable", () => {
    expect(isRunnable("java")).toBe(false);
    expect(isRunnable("cpp")).toBe(false);
    expect(isRunnable("brainfuck")).toBe(false);
  });

  it("returns an explanatory error instead of throwing for non-runnable languages", async () => {
    const result = await runCode("java", "class Main {}");
    expect(result.error).toMatch(/isn't supported/i);
    expect(result.error).toMatch(/Submit for review/i);
    expect(result.logs).toEqual([]);
  });
});
