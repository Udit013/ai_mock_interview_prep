import { describe, it, expect } from "vitest";
import {
  COMPANY_MODES,
  COMPANY_MODE_IDS,
  getCompanyMode,
  companyPromptBlock,
} from "@/constants/companies";

describe("company mode registry", () => {
  it("contains the expected software and consulting modes", () => {
    const software = ["google", "amazon", "meta", "microsoft", "stripe"];
    const consulting = ["mckinsey", "bain", "bcg", "deloitte"];
    for (const id of [...software, ...consulting]) {
      expect(COMPANY_MODE_IDS).toContain(id);
    }
  });

  it("every mode is fully populated and self-consistent", () => {
    for (const [key, mode] of Object.entries(COMPANY_MODES)) {
      expect(mode.id).toBe(key);
      expect(mode.name.length).toBeGreaterThan(1);
      expect(["software", "consulting"]).toContain(mode.category);
      expect(mode.interviewerStyle.length).toBeGreaterThan(20);
      expect(mode.questionGuidance.length).toBeGreaterThan(20);
      expect(mode.evaluationEmphasis.length).toBeGreaterThan(20);
    }
  });

  it("getCompanyMode degrades gracefully for unknown/empty ids", () => {
    expect(getCompanyMode("enron")).toBeNull();
    expect(getCompanyMode("")).toBeNull();
    expect(getCompanyMode(undefined)).toBeNull();
    expect(getCompanyMode("google")?.name).toBe("Google");
  });

  it("companyPromptBlock is empty for generic and populated for known modes", () => {
    expect(companyPromptBlock(undefined)).toBe("");
    expect(companyPromptBlock("nonexistent")).toBe("");
    const block = companyPromptBlock("amazon");
    expect(block).toMatch(/Amazon/);
    expect(block).toMatch(/Leadership Principles/);
  });
});
