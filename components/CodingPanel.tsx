"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

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
  javascript: "// Talk through your approach, then code it here.\n\n",
  python: "# Talk through your approach, then code it here.\n\n",
  java: "// Talk through your approach, then code it here.\n\n",
  cpp: "// Talk through your approach, then code it here.\n\n",
};

interface CodingPanelProps {
  language: CodingLanguage;
  onLanguageChange: (l: CodingLanguage) => void;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
}

const CodingPanel = ({
  language,
  onLanguageChange,
  onCodeChange,
  onSubmit,
  submitDisabled,
}: CodingPanelProps) => {
  const [value, setValue] = useState(STARTER[language]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dark-300 bg-dark-200/40 p-4 min-h-[480px]">
      <div className="flex items-center gap-3">
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
          }}
          className="input bg-dark-200 text-white border border-dark-300 rounded-lg px-3 py-1.5 text-sm"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="btn-primary ml-auto rounded-full px-5 py-2 text-sm disabled:opacity-50"
        >
          Submit code for review
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-dark-300">
        <MonacoEditor
          height="420px"
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
          }}
        />
      </div>
    </div>
  );
};

export default CodingPanel;
