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
        toast.error(res.error);
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
        <Button onClick={run} disabled={loading} className="btn-primary w-fit">
          {loading ? "Analyzing your résumé…" : "Get AI improvement suggestions"}
        </Button>
      )}

      {result && (
        <div className="flex flex-col gap-6 fade-up">
          <section className="flex flex-col gap-3">
            <h3>Bullet rewrites</h3>
            {result.bulletRewrites.map((r, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-dark-300 bg-dark-200/40 p-4"
              >
                <p className="text-sm text-destructive-100 line-through decoration-destructive-100/50">
                  {r.before}
                </p>
                <p className="text-sm text-success-100">{r.after}</p>
                <p className="text-xs text-light-400">{r.why}</p>
              </div>
            ))}
          </section>

          {result.missingElements.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3>What&apos;s missing</h3>
              <ul className="flex flex-col gap-1">
                {result.missingElements.map((m, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-destructive-100 mt-1">→</span>
                    <p className="text-light-400">{m}</p>
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
                    className="rounded-full bg-dark-300 px-3 py-1 text-xs"
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
