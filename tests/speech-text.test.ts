import { describe, it, expect } from "vitest";
import {
  isDegenerateReply,
  cleanSpokenText,
  splitIntoUtterances,
  MAX_SPOKEN_CHARS,
} from "@/lib/interview/speech-text";

// Reconstructed from the reply seen live: a comma loop, then echoed prompt text.
const OBSERVED =
  "That keeps document parsing free, which matches how we handle document parsing. Shifting gears to your work at the Global Health Impact Project, walk me through a specific slow query you diagnosed" +
  ",".repeat(400) +
  " mize lists or bullet points. Use paragraphs. Use paragraphs instead of bullet lists. Do not use bullet lists. Do not use bulletsizes, lists, or bullet points. Use paragraphs instead. Do not use";

describe("isDegenerateReply", () => {
  it("catches the comma loop seen in production", () => {
    expect(isDegenerateReply(OBSERVED)).toBe(true);
  });

  it("catches punctuation runs, echoed instructions and repeated phrases", () => {
    expect(isDegenerateReply("Great. , , , , , , , , What next?")).toBe(true);
    expect(isDegenerateReply("Use paragraphs instead of bullet lists, please.")).toBe(true);
    expect(
      isDegenerateReply(
        "Tell me about caching. Tell me about caching. Tell me about caching again."
      )
    ).toBe(true);
    expect(isDegenerateReply("")).toBe(true);
    expect(isDegenerateReply("x".repeat(MAX_SPOKEN_CHARS * 2))).toBe(true);
  });

  it("accepts normal interviewer speech, including numbers and technical terms", () => {
    const good = [
      "Okay, so the second write clobbered the first. What did that cost you in throughput?",
      "Right, at 1000000 requests a day that's about 12 per second. How would you size the database?",
      "Got it. How would you parse the JSON payload safely if a field is missing?",
      "Thanks, that's helpful. Let's switch gears. Which part of your résumé bullet points are you proudest of?",
      "Say p95 latency doubled after a release, but p50 held steady. Where do you start looking?",
    ];
    for (const g of good) expect(isDegenerateReply(g)).toBe(false);
  });
});

describe("cleanSpokenText", () => {
  it("removes things a speech engine would read literally", () => {
    expect(cleanSpokenText("**Great**, ,,,, let's go... `next`!")).toBe("Great, let's go… next!");
    expect(cleanSpokenText("See [the docs](https://x.y) now.")).toBe("See now.");
  });

  it("caps long text, preferring to end on the question", () => {
    const long = `${"We covered a lot. ".repeat(30)}What would you change first? ${"Extra. ".repeat(40)}`;
    const out = cleanSpokenText(long);
    expect(out.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(/[?.!…]$/.test(out)).toBe(true);
  });
});

describe("splitIntoUtterances", () => {
  it("splits into sentence-sized chunks without losing text", () => {
    const text = "Okay. That makes sense. How would you test it?";
    const chunks = splitIntoUtterances(text, 30);
    expect(chunks.join(" ")).toBe(text);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(30);
  });

  it("breaks an overlong sentence on commas", () => {
    const sentence = Array.from({ length: 20 }, (_, i) => `clause number ${i}`).join(", ") + ".";
    const chunks = splitIntoUtterances(sentence, 80);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(80);
  });
});
