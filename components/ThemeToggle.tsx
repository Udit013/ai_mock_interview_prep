"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  THEME_EVENT,
  applyThemeChoice,
  readThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const Icon = ({ choice }: { choice: ThemeChoice }) => {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (choice === "light")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (choice === "dark")
    return (
      <svg {...common}>
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
};

/**
 * Theme picker: System (follows the OS, live), Light or Dark. The choice is
 * remembered; "System" also tracks OS changes while the page is open.
 */
const ThemeToggle = () => {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    setChoice(readThemeChoice());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readThemeChoice() === "system") applyThemeChoice("system");
    };
    const onChange = (e: Event) => setChoice((e as CustomEvent<ThemeChoice>).detail);
    media.addEventListener("change", onSystem);
    window.addEventListener(THEME_EVENT, onChange);
    return () => {
      media.removeEventListener("change", onSystem);
      window.removeEventListener(THEME_EVENT, onChange);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (value: ThemeChoice) => {
    applyThemeChoice(value);
    setChoice(value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="card-menu-trigger"
        aria-label={`Theme: ${OPTIONS.find((o) => o.value === choice)?.label}. Change theme`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon choice={choice} />
      </button>
      {open && (
        <div
          id={`${id}-menu`}
          role="menu"
          aria-label="Theme"
          className="card-menu"
          style={{ minWidth: "10rem" }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
          }}
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={choice === o.value}
              onClick={() => pick(o.value)}
            >
              <Icon choice={o.value} />
              <span className="flex-1">{o.label}</span>
              {choice === o.value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
