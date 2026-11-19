import { cn } from "@/lib/utils";

/**
 * PrepWise mark: an ink tile holding a short level meter — a voice
 * interview, in four bars. Pure SVG coloured from theme tokens, so it reads
 * correctly in light and dark without separate assets.
 */
export const LogoMark = ({ size = 28, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    aria-hidden="true"
    className={cn("shrink-0", className)}
  >
    {/* Same geometry as app/icon.svg (the favicon). */}
    <rect width="32" height="32" rx="7.5" style={{ fill: "var(--ink)" }} />
    <rect x="5" y="12" width="4" height="8" rx="2" style={{ fill: "var(--ink-fg)" }} />
    <rect x="11" y="6" width="4" height="20" rx="2" style={{ fill: "var(--mark-accent)" }} />
    <rect x="17" y="9.5" width="4" height="13" rx="2" style={{ fill: "var(--ink-fg)" }} />
    <rect x="23" y="13" width="4" height="6" rx="2" style={{ fill: "var(--ink-fg)" }} />
  </svg>
);

const Logo = ({ className, size = 28 }: { className?: string; size?: number }) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <LogoMark size={size} />
    <span className="text-lg font-semibold tracking-tight text-fg">PrepWise</span>
  </span>
);

export default Logo;
