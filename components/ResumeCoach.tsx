"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { suggestResumeImprovements } from "@/lib/actions/resume.action";
import type { ResumeImprovements } from "@/lib/ai/resume";

const ResumeCoach = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeImprovements | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await suggestResumeImprovements();
      if (!res.success) {
        toast.error(res.error, {
          action: { label: "Try again", onClick: () => void run() },
        });
        return;
      }
      setResult(res.improvements);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!result && (
        <Button
          onClick={run}
          disabled={loading}
          aria-busy={loading}
          className="btn-primary w-fit"
        >
          {loading ? "Analyzing your résumé…" : "Get AI improvement suggestions"}
        </Button>
      )}

      {/* Polite live region: announces progress and completion to screen readers. */}
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? "Analyzing your résumé…" : result ? "Suggestions ready." : ""}
      </p>

      {loading && !result && (
        <div aria-hidden="true" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-6 fade-up">
          <section className="flex flex-col gap-3">
            <h3>Bullet rewrites</h3>
            {result.bulletRewrites.map((r, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[4.5rem_1fr]"
              >
                <p className="eyebrow !text-fg-muted pt-0.5">Before</p>
                <p className="text-sm text-fg-muted line-through decoration-fg-muted/40">
                  {r.before}
                </p>
                <p className="eyebrow pt-0.5">After</p>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium leading-relaxed text-fg">{r.after}</p>
                  <p className="text-xs text-fg-muted">{r.why}</p>
                </div>
              </div>
            ))}
          </section>

          {result.missingElements.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3>What&apos;s missing</h3>
              <ul className="flex list-none flex-col gap-1.5 p-0">
                {result.missingElements.map((m, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary-200" aria-hidden="true" />
                    <p className="text-fg-soft">{m}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.atsKeywords.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3>ATS keywords to consider</h3>
              <div className="flex flex-wrap gap-2">
                {result.atsKeywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-fg-soft"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3>Overall advice</h3>
            <p className="text-light-400">{result.overallAdvice}</p>
          </section>

          <Button
            onClick={run}
            disabled={loading}
            className="btn-secondary w-fit"
          >
            {loading ? "Re-analyzing…" : "Re-run analysis"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ResumeCoach;
