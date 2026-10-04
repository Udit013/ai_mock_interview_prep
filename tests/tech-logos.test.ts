import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Fresh module per test so the in-memory cache starts empty. */
async function load(fetchImpl: (url: string) => Promise<Response>) {
  const spy = vi.fn(fetchImpl);
  vi.stubGlobal("fetch", spy);
  const { getTechLogos } = await import("@/lib/utils");
  return { getTechLogos, spy };
}

const ok = async () => new Response(null, { status: 200 });

describe("getTechLogos", () => {
  it("returns the devicon URL when the icon exists", async () => {
    const { getTechLogos } = await load(ok);
    expect(await getTechLogos(["React"])).toEqual([
      {
        tech: "React",
        url: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
      },
    ]);
  });

  it("skips the network for techs with no known icon", async () => {
    const { getTechLogos, spy } = await load(ok);
    expect(await getTechLogos(["SomeInternalTool"])).toEqual([
      { tech: "SomeInternalTool", url: "/tech.svg" },
    ]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("checks each icon once across renders", async () => {
    const { getTechLogos, spy } = await load(ok);
    await getTechLogos(["React", "Node.js"]);
    await getTechLogos(["React", "Node.js"]);
    await Promise.all([getTechLogos(["React"]), getTechLogos(["React"])]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("falls back when the CDN says the icon is missing", async () => {
    const { getTechLogos } = await load(
      async () => new Response(null, { status: 404 })
    );
    expect((await getTechLogos(["React"]))[0].url).toBe("/tech.svg");
  });

  it("does not cache a network failure", async () => {
    let calls = 0;
    const { getTechLogos } = await load(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("network down");
      return new Response(null, { status: 200 });
    });
    expect((await getTechLogos(["React"]))[0].url).toBe("/tech.svg");
    expect((await getTechLogos(["React"]))[0].url).toMatch(/react-original/);
  });
});
