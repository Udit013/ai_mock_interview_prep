"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ReplayPlayerProps {
  transcript: { role: string; content: string }[];
  userName: string;
  finalCode?: { language: string; code: string };
}

/** Milliseconds each message stays before auto-advancing during playback. */
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
            className="text-sm text-light-400 hover:text-white transition-colors"
          >
            Skip to end
          </button>
        )}
        <span className="ml-auto text-xs text-light-400">
          {visibleCount}/{transcript.length} turns
        </span>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-dark-300 bg-dark-200/40 p-6 max-h-[60vh] overflow-y-auto">
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
              <Image
                src={isUser ? "/user-avatar.png" : "/ai-avatar.png"}
                alt={isUser ? userName : "AI Interviewer"}
                width={36}
                height={36}
                className="rounded-full object-cover size-9 shrink-0 mt-1"
              />
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  isUser
                    ? "bg-primary-200/15 border border-primary-200/30"
                    : "bg-dark-300"
                )}
              >
                <p className="text-xs text-light-400 mb-1">
                  {isUser ? userName : "AI Interviewer"}
                </p>
                <p>{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {finalCode && visibleCount >= transcript.length && (
        <div className="flex flex-col gap-2 replay-message">
          <h3 className="text-lg">Submitted code ({finalCode.language})</h3>
          <pre className="rounded-xl border border-dark-300 bg-dark-300/60 p-4 text-sm overflow-x-auto">
            <code>{finalCode.code}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default ReplayPlayer;
