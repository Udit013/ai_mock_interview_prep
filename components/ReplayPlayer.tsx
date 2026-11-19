"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/Logo";
import { monogram } from "@/lib/interview/company";

interface ReplayPlayerProps {
  transcript: { role: string; content: string }[];
  userName: string;
  finalCode?: { language: string; code: string };
}

/** Milliseconds each message stays before auto-advancing during playback. */
const PROBLEM_MARKER = /\n*\[Problem shown on screen\]:\s*/;

/**
 * Coding openings store the on-screen problem after a marker so feedback and
 * replay keep the context. Show it as a labelled block rather than the raw tag.
 */
const ReplayContent = ({ content }: { content: string }) => {
  const [spoken, problem] = content.split(PROBLEM_MARKER);
  return (
    <>
      <p>{spoken}</p>
      {problem && (
        <div className="mt-3 rounded-lg border border-line bg-dark-200/60 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-light-400 mb-1">
            Problem shown on screen
          </p>
          <p className="whitespace-pre-wrap">{problem}</p>
        </div>
      )}
    </>
  );
};

const advanceDelay = (content: string) =>
  Math.min(Math.max(content.length * 35, 1800), 8000);

const ReplayPlayer = ({ transcript, userName, finalCode }: ReplayPlayerProps) => {
  const [visibleCount, setVisibleCount] = useState(transcript.length);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    if (!playing) {
      clearTimer();
      return;
    }
    if (visibleCount >= transcript.length) {
      setPlaying(false);
      return;
    }
    const next = transcript[visibleCount];
    timerRef.current = setTimeout(
      () => setVisibleCount((c) => c + 1),
      advanceDelay(next.content)
    );
    return clearTimer;
  }, [playing, visibleCount, transcript]);

  useEffect(() => {
    if (playing) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleCount, playing]);

  const startPlayback = () => {
    setVisibleCount(1);
    setPlaying(true);
  };

  const shown = transcript.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {playing ? (
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="btn-secondary rounded-full px-5 py-2 text-sm"
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={startPlayback}
            className="btn-primary rounded-full px-5 py-2 text-sm"
          >
            ▶ Play replay
          </button>
        )}
        {visibleCount < transcript.length && (
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setVisibleCount(transcript.length);
            }}
            className="text-sm text-light-400 hover:text-fg transition-colors"
          >
            Skip to end
          </button>
        )}
        <span className="ml-auto text-xs text-light-400">
          {visibleCount}/{transcript.length} turns
        </span>
      </div>

      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-xl border border-line bg-surface p-6">
        {shown.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div
              key={i}
              className={cn(
                "flex gap-3 items-start replay-message",
                isUser && "flex-row-reverse"
              )}
            >
              {isUser ? (
                <span
                  aria-hidden="true"
                  className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-fg-soft"
                >
                  {monogram(userName || "You")}
                </span>
              ) : (
                <LogoMark size={32} className="mt-1" />
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl border px-4 py-3 text-sm leading-relaxed",
                  isUser ? "border-line bg-surface-3" : "border-line bg-surface-2"
                )}
              >
                <p className="text-xs text-light-400 mb-1">
                  {isUser ? userName : "AI Interviewer"}
                </p>
                <ReplayContent content={m.content} />
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {finalCode && visibleCount >= transcript.length && (
        <div className="flex flex-col gap-2 replay-message">
          <h3 className="text-lg">Submitted code ({finalCode.language})</h3>
          <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-4 text-sm">
            <code>{finalCode.code}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default ReplayPlayer;
