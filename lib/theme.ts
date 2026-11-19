/**
 * Light / dark theme: "system" (default) follows the OS; "light" and "dark"
 * are explicit choices saved in localStorage. The class on <html> is what
 * the stylesheet keys off (`.dark`).
 */

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "prepwise-theme";
export const THEME_EVENT = "prepwise-theme-change";

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "system" || v === "light" || v === "dark";
}

/** Resolve a choice to the theme actually shown. */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): "light" | "dark" {
  if (choice === "system") return systemPrefersDark ? "dark" : "light";
  return choice;
}

/**
 * Runs inline in <head> before first paint, so the page never flashes the
 * wrong theme. Kept tiny and self-contained (no imports, no React).
 */
export const NO_FLASH_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_STORAGE_KEY}");var d=c==="dark"||((c!=="light")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(v) ? v : "system";
  } catch {
    return "system";
  }
}

/** Apply a choice to the document and remember it. */
export function applyThemeChoice(choice: ThemeChoice) {
  const dark = resolveTheme(choice, window.matchMedia("(prefers-color-scheme: dark)").matches) === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* private mode: the choice just won't persist */
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: choice }));
}
