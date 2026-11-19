/**
 * Live Gemini smoke test — OPT-IN, never runs in CI.
 *
 *   LIVE_AI=1 npx vitest run tests/live-ai.test.ts
 *
 * Calls the real free-tier API (a handful of requests) with the key in
 * .env.local, through the same functions production uses. It exists to prove
 * that dependency upgrades preserve structured outputs and the model
 * fallback chain — the parts unit tests can only simulate.
 */
import fs from "fs";
import { describe, expect, it } from "vitest";
import { generateObject, generateText } from "ai";

const LIVE = process.env.LIVE_AI === "1";

if (LIVE) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"([\s\S]*)"$/, "$1");
  }
}

const RESUME = `Jordan Rivera — Software Engineer. jordan@example.com
Experience: Backend Engineer at Acme Logistics (2022–present). Built a Go
service that routes 40k shipments/day; cut p95 latency from 900ms to 180ms by
adding a Redis cache and batching database writes. Led migration from cron jobs
to a queue-based scheduler. Projects: TrailMap — React Native app for hikers
with offline maps (5k downloads). Skills: Go, TypeScript, PostgreSQL, Redis,
Kubernetes, React. Education: BS Computer Science, State University, 2022.`;

describe.skipIf(!LIVE)("live Gemini (opt-in)", () => {
  it("structures a résumé and coaches it (structured output)", async () => {
    const { structureResume, generateResumeImprovements, resumeSchema, resumeImprovementSchema } =
      await import("@/lib/ai/resume");
    const parsed = await structureResume(RESUME);
    expect(resumeSchema.safeParse(parsed).success).toBe(true);
    // Skills come back as areas by design; concrete facts must survive.
    expect(parsed.skills.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed)).toMatch(/TrailMap|Acme/);

    const tips = await generateResumeImprovements(parsed);
    expect(resumeImprovementSchema.safeParse(tips).success).toBe(true);
  }, 90_000);

  it("runs an adaptive interview turn (schema, token cap, guards)", async () => {
    const { runAdaptiveTurn, DEFAULT_INTERVIEW_STATE, adaptiveTurnSchema } = await import("@/lib/ai/adaptive");
    const { turn, isFinished } = await runAdaptiveTurn({
      role: "Backend Engineer",
      level: "Mid",
      type: "Technical",
      seedQuestions: ["How would you design a rate limiter?", "How do you debug a slow SQL query?"],
      conversationHistory: [{ role: "assistant", content: "How would you design a rate limiter?" }],
      userAnswer: "I'd use a token bucket per user in Redis with an atomic Lua script, refilling based on elapsed time.",
      currentState: DEFAULT_INTERVIEW_STATE,
      exchangeCount: 1,
      maxExchanges: 6,
    } as Parameters<typeof runAdaptiveTurn>[0]);
    expect(adaptiveTurnSchema.safeParse(turn).success).toBe(true);
    expect(turn.spokenResponse.length).toBeGreaterThan(20);
    expect(isFinished).toBe(false);
  }, 90_000);

  it("scores a transcript with the feedback schema (quality chain)", async () => {
    const { withModelFallback, MODEL_MAX_RETRIES } = await import("@/lib/ai/models");
    const { feedbackSchema } = await import("@/constants");
    const { object } = await withModelFallback("quality", (model) =>
      generateObject({
        model,
        maxRetries: MODEL_MAX_RETRIES,
        schema: feedbackSchema,
        prompt:
          "Score this short mock interview on Communication Skills, Technical Knowledge, Problem Solving, Cultural Fit and Confidence and Clarity.\n- assistant: Tell me about a hard bug.\n- user: A race condition in our payment queue; I reproduced it with a stress test, added idempotency keys, and wrote a postmortem.",
      })
    );
    expect(feedbackSchema.safeParse(object).success).toBe(true);
    expect(object.categoryScores.length).toBeGreaterThanOrEqual(3);
  }, 90_000);

  it("generates plain text (question generation path)", async () => {
    const { withModelFallback, MODEL_MAX_RETRIES } = await import("@/lib/ai/models");
    const { text } = await withModelFallback("quality", (model) =>
      generateText({ model, maxRetries: MODEL_MAX_RETRIES, prompt: 'Return a JSON array of 2 short interview questions for a junior frontend developer. Only the JSON array.' })
    );
    const json = JSON.parse(text.replace(/```json|```/g, "").trim());
    expect(Array.isArray(json)).toBe(true);
  }, 90_000);

  it("fails over from a retired model id to a working one (real 404)", async () => {
    const { withModelFallback, MODEL_MAX_RETRIES, modelChain } = await import("@/lib/ai/models");
    const used: string[] = [];
    const { text } = await withModelFallback(
      "interview",
      (model, id) => {
        used.push(id);
        return generateText({ model, maxRetries: MODEL_MAX_RETRIES, prompt: "Reply with the single word: ok" });
      },
      { chain: ["gemini-0.0-does-not-exist", modelChain("interview")[0]] }
    );
    expect(used).toEqual(["gemini-0.0-does-not-exist", modelChain("interview")[0]]);
    expect(text.toLowerCase()).toContain("ok");
  }, 90_000);
});
