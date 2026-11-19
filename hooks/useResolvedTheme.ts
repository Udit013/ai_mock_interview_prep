"use client";

import { useEffect, useState } from "react";

/**
 * The theme actually on screen ("light" | "dark"), kept in sync with the
 * `.dark` class on <html> — which changes on manual choice or OS change.
 * For third-party widgets (editor, toasts) that need an explicit theme.
 */
export function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
