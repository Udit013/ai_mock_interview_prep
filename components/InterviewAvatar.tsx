import { cn } from "@/lib/utils";
import { monogram, paletteIndex } from "@/lib/interview/company";

/** Muted gradients that sit well on the dark theme. */
const PALETTE = [
  "from-[#6d5dfc] to-[#3b2fb0]",
  "from-[#2fb5a3] to-[#16756a]",
  "from-[#e0795f] to-[#9c4430]",
  "from-[#4b8df8] to-[#2552a8]",
  "from-[#c46ad6] to-[#7c3a8c]",
  "from-[#d4a63a] to-[#8a6a1c]",
];

/**
 * Monogram avatar for an interview: the company's initials when one was
 * entered, otherwise the role's. Replaces random brand logos, which implied
 * an affiliation with companies that had nothing to do with the interview.
 */
const InterviewAvatar = ({
  company,
  role,
  size = 90,
  className,
}: {
  company?: string | null;
  role: string;
  size?: number;
  className?: string;
}) => {
  const label = company?.trim() || role;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white/10",
        PALETTE[paletteIndex(label, PALETTE.length)],
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {monogram(label)}
    </div>
  );
};

export default InterviewAvatar;
