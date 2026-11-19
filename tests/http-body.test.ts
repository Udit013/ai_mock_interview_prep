import { describe, expect, it } from "vitest";
import { hasOversizedArray, MAX_ARRAY_ITEMS, readJsonBody } from "@/lib/http/body";

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method: "POST", body, headers });

describe("readJsonBody", () => {
  it("returns the parsed value for a normal body", async () => {
    expect(await readJsonBody(req('{"a":[1,2,3]}'), 1000)).toEqual({ ok: true, value: { a: [1, 2, 3] } });
  });

  it("rejects malformed JSON with 400", async () => {
    expect(await readJsonBody(req("{nope"), 1000)).toEqual({ ok: false, status: 400 });
  });

  it("rejects bodies over the byte cap with 413, even without content-length", async () => {
    expect(await readJsonBody(req(JSON.stringify({ s: "x".repeat(2000) })), 1000)).toEqual({ ok: false, status: 413 });
  });

  it("rejects early on a large declared content-length", async () => {
    expect(await readJsonBody(req("{}", { "content-length": "999999" }), 1000)).toEqual({ ok: false, status: 413 });
  });

  it("rejects a junk array that would make Zod allocate an issue per element", async () => {
    const attack = JSON.stringify({ strengths: Array(MAX_ARRAY_ITEMS + 1).fill(1) });
    expect(await readJsonBody(req(attack), 1_000_000)).toEqual({ ok: false, status: 413 });
  });
});

describe("hasOversizedArray", () => {
  it("finds oversized arrays nested inside objects and arrays", () => {
    expect(hasOversizedArray({ a: [{ b: Array(6).fill(0) }] }, 5)).toBe(true);
    expect(hasOversizedArray({ a: [{ b: Array(5).fill(0) }] }, 5)).toBe(false);
  });

  it("rejects absurd nesting depth", () => {
    let deep: unknown = 1;
    for (let i = 0; i < 30; i++) deep = [deep];
    expect(hasOversizedArray(deep)).toBe(true);
  });
});
