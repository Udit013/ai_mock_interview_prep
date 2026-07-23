"use client";

import { cn } from "@/lib/utils";

interface ProblemPanelProps {
  questions: string[];
  activeIndex: number;
  /** Lets the candidate read ahead / back without changing what's being asked. */
  onSelect?: (index: number) => void;
}

/**
 * Shows the coding problem on screen so the interviewer never has to read the
 * full statement aloud. Multi-problem rounds get a compact selector.
 */
const ProblemPanel = ({
  questions,
  activeIndex,
  onSelect,
}: ProblemPanelProps) => {
  if (questions.length === 0) return null;

  const safeIndex = Math.min(Math.max(activeIndex, 0), questions.length - 1);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dark-300 bg-dark-200/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg">Problem</h3>
        {questions.length > 1 && (
          <div className="flex items-center gap-1">
            {questions.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect?.(i)}
                aria-label={`Show problem ${i + 1}`}
                aria-current={i === safeIndex}
                className={cn(
                  "size-7 rounded-md text-xs font-medium transition-colors",
                  i === safeIndex
                    ? "bg-primary-200 text-dark-100"
                    : "bg-dark-300 text-light-400 hover:text-white"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="whitespace-pre-wrap leading-relaxed text-light-100 max-h-[38vh] overflow-y-auto">
        {questions[safeIndex]}
      </p>

      {questions.length > 1 && (
        <p className="text-xs text-light-400">
          Problem {safeIndex + 1} of {questions.length}
          {activeIndex !== safeIndex ? "" : " · currently being discussed"}
        </p>
      )}
    </div>
  );
};

export default ProblemPanel;
