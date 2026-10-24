import { cn } from "@/lib/utils";

const tone = (score: number) =>
  score >= 80
    ? { stroke: "stroke-success-100", text: "text-success-100", label: "Strong" }
    : score >= 60
    ? { stroke: "stroke-yellow-400", text: "text-yellow-400", label: "Solid" }
    : { stroke: "stroke-destructive-100", text: "text-destructive-100", label: "Needs work" };

/** Dependency-free circular score gauge; fills in on load. */
const ScoreRing = ({ score, size = 148 }: { score: number; size?: number }) => {
  const clamped = Math.min(Math.max(Math.round(score), 0), 100);
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const { stroke, text, label } = tone(clamped);

  return (
    <div
      role="img"
      aria-label={`Overall score: ${clamped} out of 100 — ${label}`}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="9" className="stroke-white/10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className={cn("ring-fill", stroke)}
          style={
            {
              strokeDasharray: circumference,
              strokeDashoffset: circumference * (1 - clamped / 100),
              "--ring-circumference": circumference,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className={cn("text-4xl font-bold leading-none", text)}>{clamped}</span>
        <span className="mt-1 text-xs text-light-400">out of 100</span>
      </div>
    </div>
  );
};

export default ScoreRing;
