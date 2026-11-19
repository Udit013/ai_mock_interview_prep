import { describe, it, expect } from "vitest";
import { resolveTheme, isThemeChoice, NO_FLASH_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme", () => {
  it("resolves system to the OS preference and respects explicit choices", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("only accepts known stored values", () => {
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("purple")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });

  it("ships a self-contained pre-paint script that reads the same key", () => {
    expect(NO_FLASH_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(NO_FLASH_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(NO_FLASH_SCRIPT.length).toBeLessThan(500);
    // Valid JavaScript on its own (no imports or JSX).
    expect(() => new Function(NO_FLASH_SCRIPT)).not.toThrow();
  });
});
