"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  runCode,
  isRunnable,
  pythonNeedsWarmup,
  type RunResult,
} from "@/lib/runner/code-runner";

// Monaco loads its assets lazily from CDN only when this panel mounts.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-light-400 text-sm">
      Loading editor…
    </div>
  ),
});

export type CodingLanguage = "javascript" | "python" | "java" | "cpp";

const LANGUAGES: { id: CodingLanguage; label: string }[] = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
];

const STARTER: Record<CodingLanguage, string> = {
  javascript:
    "// Talk through your approach, then code it here.\n// Use console.log(...) to print output when you Run.\n\n",
  python:
    "# Talk through your approach, then code it here.\n# Use print(...) to see output when you Run.\n\n",
  java: "// Talk through your approach, then code it here.\n\n",
  cpp: "// Talk through your approach, then code it here.\n\n",
};

interface CodingPanelProps {
  language: CodingLanguage;
  onLanguageChange: (l: CodingLanguage) => void;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  /** True while the interview is live — Submit needs an interviewer to talk to. */
  interviewActive: boolean;
}

const CodingPanel = ({
  language,
  onLanguageChange,
  onCodeChange,
  onSubmit,
  interviewActive,
}: CodingPanelProps) => {
  const [value, setValue] = useState(STARTER[language]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [warmingPython, setWarmingPython] = useState(false);

  const canRun = isRunnable(language);

  const handleRun = async () => {
    if (!canRun || running) return;
    setRunning(true);
    setResult(null);
    // First Python run downloads the runtime — tell the user why it's slow.
    setWarmingPython(language === "python" && pythonNeedsWarmup());
    try {
      setResult(await runCode(language, value));
    } finally {
      setRunning(false);
      setWarmingPython(false);
    }
  };

  const hasOutput = result && (result.logs.length > 0 || result.error);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dark-300 bg-dark-200/40 p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-light-400" htmlFor="coding-language">
          Language
        </label>
        <select
          id="coding-language"
          value={language}
          onChange={(e) => {
            const next = e.target.value as CodingLanguage;
            onLanguageChange(next);
            setValue(STARTER[next]);
            onCodeChange(STARTER[next]);
            setResult(null);
          }}
          className="input bg-dark-200 text-white border border-dark-300 rounded-lg px-3 py-1.5 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun || running}
            title={
              canRun
                ? "Run your code in a sandbox"
                : "Running is available for JavaScript and Python. Java and C++ are reviewed by the interviewer."
            }
            className={cn(
              "btn-secondary rounded-full px-5 py-2 text-sm",
              (!canRun || running) && "opacity-50 cursor-not-allowed"
            )}
          >
            {running ? "Running…" : "▶ Run"}
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!interviewActive}
            title={
              interviewActive
                ? "Ask the interviewer to review your code"
                : "Start the interview first — the interviewer reviews your code out loud."
            }
            className={cn(
              "btn-primary rounded-full px-5 py-2 text-sm",
              !interviewActive && "opacity-50 cursor-not-allowed"
            )}
          >
            Submit for review
          </button>
        </div>
      </div>

      {!canRun && (
        <p className="text-xs text-light-400">
          In-browser execution supports JavaScript and Python. {LANGUAGES.find((l) => l.id === language)?.label} code is
          still reviewed by the interviewer on submit.
        </p>
      )}

      {/* Editor */}
      <div className="overflow-hidden rounded-lg border border-dark-300">
        <MonacoEditor
          height="380px"
          language={language}
          value={value}
          theme="vs-dark"
          onChange={(v) => {
            setValue(v ?? "");
            onCodeChange(v ?? "");
          }}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
            tabSize: 2,
          }}
        />
      </div>

      {/* Output console */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold">Output</h4>
          {result && !running && (
            <span className="text-xs text-light-400">
              {result.timedOut
                ? "timed out"
                : result.error
                ? "error"
                : `finished in ${result.durationMs}ms`}
            </span>
          )}
        </div>

        <pre
          aria-live="polite"
          className={cn(
            "min-h-[92px] max-h-[220px] overflow-auto rounded-lg border border-dark-300 bg-dark-300/50 p-3 text-xs leading-relaxed whitespace-pre-wrap",
            result?.error ? "text-destructive-100" : "text-light-100"
          )}
        >
          {running
            ? warmingPython
              ? "Downloading the Python runtime (first run only)…"
              : "Running…"
            : hasOutput
            ? [...(result?.logs ?? []), result?.error]
                .filter(Boolean)
                .join("\n")
            : result
            ? "(no output — did you print anything?)"
            : canRun
            ? "Run your code to see output here."
            : "Output is available for JavaScript and Python."}
        </pre>
      </div>
    </div>
  );
};

export default CodingPanel;
