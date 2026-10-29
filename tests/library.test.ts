import { describe, it, expect } from "vitest";
import {
  normalizeCollectionName,
  summarizeCollections,
  parseLibraryView,
  filterLibrary,
  countArchived,
  MAX_COLLECTION_CHARS,
} from "@/lib/interview/library";

const items = [
  { id: "a", collection: "Stripe loop" },
  { id: "b", collection: "stripe LOOP" },
  { id: "c", collection: "FAANG prep" },
  { id: "d" },
  { id: "e", collection: "FAANG prep", archived: true },
  { id: "f", archived: true },
  { id: "g", collection: "Stripe loop", deleted: true },
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("normalizeCollectionName", () => {
  it("trims and keeps name-like characters", () => {
    expect(normalizeCollectionName("  Stripe   loop ")).toBe("Stripe loop");
    expect(normalizeCollectionName("C++ / Systems #1")).toBe("C++ / Systems #1");
    expect(normalizeCollectionName("Q4\n<script>")).toBe("Q4 script");
  });
  it("caps length and treats blank as none", () => {
    expect(normalizeCollectionName("x".repeat(100))!.length).toBe(MAX_COLLECTION_CHARS);
    expect(normalizeCollectionName("   ")).toBeNull();
    expect(normalizeCollectionName(null)).toBeNull();
  });
});

describe("summarizeCollections", () => {
  it("groups case-insensitively, counts only active interviews, sorts by name", () => {
    expect(summarizeCollections(items)).toEqual([
      { name: "FAANG prep", count: 1 },
      { name: "Stripe loop", count: 2 },
    ]);
  });
});

describe("parseLibraryView", () => {
  it("reads archived, collection and default views", () => {
    expect(parseLibraryView({ view: "archived" })).toEqual({ kind: "archived" });
    expect(parseLibraryView({ collection: " Stripe loop " })).toEqual({ kind: "collection", name: "Stripe loop" });
    expect(parseLibraryView({ collection: ["FAANG prep", "x"] })).toEqual({ kind: "collection", name: "FAANG prep" });
    expect(parseLibraryView({})).toEqual({ kind: "all" });
    expect(parseLibraryView({ collection: "   " })).toEqual({ kind: "all" });
  });
});

describe("filterLibrary", () => {
  it("All hides archived and deleted", () => {
    expect(ids(filterLibrary(items, { kind: "all" }))).toEqual(["a", "b", "c", "d"]);
  });
  it("a collection matches case-insensitively and excludes archived", () => {
    expect(ids(filterLibrary(items, { kind: "collection", name: "STRIPE LOOP" }))).toEqual(["a", "b"]);
    expect(ids(filterLibrary(items, { kind: "collection", name: "FAANG prep" }))).toEqual(["c"]);
  });
  it("Archived shows only archived, never deleted", () => {
    expect(ids(filterLibrary(items, { kind: "archived" }))).toEqual(["e", "f"]);
    expect(countArchived(items)).toBe(2);
  });
});
