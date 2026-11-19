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
    viewBox="0 0 28 28"
    aria-hidden="true"
    className={cn("shrink-0", className)}
  >
    <rect width="28" height="28" rx="7" style={{ fill: "var(--ink)" }} />
    <rect x="7" y="11" width="2.6" height="6" rx="1.3" style={{ fill: "var(--ink-fg)" }} />
    <rect x="11.4" y="7.5" width="2.6" height="13" rx="1.3" style={{ fill: "var(--brand)" }} />
    <rect x="15.8" y="9.5" width="2.6" height="9" rx="1.3" style={{ fill: "var(--ink-fg)" }} />
    <rect x="20.2" y="12" width="2.6" height="4" rx="1.3" style={{ fill: "var(--ink-fg)" }} />
  </svg>
);

const Logo = ({ className, size = 28 }: { className?: string; size?: number }) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <LogoMark size={size} />
    <span className="text-lg font-semibold tracking-tight text-fg">PrepWise</span>
  </span>
);

export default Logo;
