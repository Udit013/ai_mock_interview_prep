import { cn } from "@/lib/utils";
import { monogram, paletteIndex } from "@/lib/interview/company";

/**
 * Monogram avatar for an interview: the company's initials when one was
 * entered, otherwise the role's. Soft, theme-aware fills (defined per theme
 * in globals.css) instead of saturated gradients or brand logos.
 */
const InterviewAvatar = ({
  company,
  role,
  size = 56,
  className,
}: {
  company?: string | null;
  role: string;
  size?: number;
  className?: string;
}) => {
  const label = company?.trim() || role;
  const hue = paletteIndex(label, 6) + 1;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-xl font-semibold tracking-tight",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `var(--av-${hue}-bg)`,
        color: `var(--av-${hue}-fg)`,
      }}
    >
      {monogram(label)}
    </div>
  );
};

export default InterviewAvatar;
