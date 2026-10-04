"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Robust wrapper around the browser's SpeechRecognition API.
 *
 * The naive usage (`continuous = false`, submit on the first final result)
 * fails badly for interviews: it cuts the candidate off at their first pause,
 * discards everything after it, and offers no chance to correct a mis-hearing.
 * This hook fixes that:
 *
 *  - `continuous = true` so natural pauses don't end the answer
 *  - final segments accumulate into one transcript instead of replacing it
 *  - a silence timer decides when the answer is actually over
 *  - Chrome ends recognition on its own periodically; we transparently restart
 *  - microphone permission is checked up front with actionable errors
 *  - the transcript is exposed as editable state so the UI can offer a review
 *
 * Browser-native and free — no external speech service.
 */

export type MicPermission = "unknown" | "granted" | "denied" | "prompt";
export type ListenStatus = "idle" | "starting" | "listening" | "stopped";

export interface SpeechTiming {
  /** When the mic opened. */
  startedAt: number;
  /** When the candidate first produced speech, or null if they never did. */
  firstSpeechAt: number | null;
  /** When the last speech result arrived. */
  lastSpeechAt: number | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Human-readable, actionable messages for each SpeechRecognition error code. */
export function describeSpeechError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Allow it in your browser's address-bar icon, then try again.";
    case "audio-capture":
      return "No microphone was found. Check that one is connected and not in use by another app.";
    case "network":
      return "Speech recognition needs a network connection and it looks like it dropped. Check your connection.";
    case "aborted":
      return "Listening stopped.";
    case "no-speech":
      return "I didn't catch anything. Try speaking a little louder or closer to the mic.";
    default:
      return `Microphone error (${code}). Try again, or reload the page if it persists.`;
  }
}

interface UseSpeechRecognitionOptions {
  /** Fired when the answer is considered complete (silence or manual stop). */
  onFinalize: (transcript: string, timing: SpeechTiming) => void;
  /** How long a pause must last before the answer is treated as finished. */
  silenceMs?: number;
  lang?: string;
}

export function useSpeechRecognition({
  onFinalize,
  silenceMs = 3500,
  lang = "en-US",
}: UseSpeechRecognitionOptions) {
  const [isSupported, setIsSupported] = useState(true);
  const [status, setStatus] = useState<ListenStatus>("idle");
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Non-null while the silence countdown before auto-submit is running. */
  const [pendingAutoSubmit, setPendingAutoSubmit] = useState(false);

  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const shouldListenRef = useRef(false);
  const transcriptRef = useRef("");
  const timingRef = useRef<SpeechTiming>({
    startedAt: 0,
    firstSpeechAt: null,
    lastSpeechAt: null,
  });
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartCountRef = useRef(0);
  /** Guards finalize() against firing twice for the same answer. */
  const finalizedRef = useRef(false);
  const onFinalizeRef = useRef(onFinalize);

  // Keep the callback fresh without re-registering recognition handlers.
  useEffect(() => {
    onFinalizeRef.current = onFinalize;
  }, [onFinalize]);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    setPendingAutoSubmit(false);
  }, []);

  /**
   * Stop listening and hand the accumulated transcript to the caller.
   * Idempotent per answer, and works even when recognition never started so a
   * typed answer (unsupported browser / denied mic) submits through one path.
   */
  const finalize = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    const wasListening = shouldListenRef.current;
    shouldListenRef.current = false;
    clearSilenceTimer();

    if (wasListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* already stopped */
      }
    }

    setStatus("stopped");
    setInterim("");
    onFinalizeRef.current(transcriptRef.current.trim(), timingRef.current);
  }, [clearSilenceTimer]);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    // Only auto-submit once the candidate has actually said something —
    // otherwise a slow starter would be submitted as an empty answer.
    if (!transcriptRef.current.trim()) return;
    setPendingAutoSubmit(true);
    silenceTimerRef.current = setTimeout(finalize, silenceMs);
  }, [clearSilenceTimer, finalize, silenceMs]);

  /** Ask for microphone access explicitly so the prompt is predictable. */
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setPermission("denied");
      setError(
        "This browser can't access the microphone. Try Chrome or Edge on desktop."
      );
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We only needed the permission grant; release the device immediately so
      // SpeechRecognition can take it and no recording indicator lingers.
      stream.getTracks().forEach((t) => t.stop());
      setPermission("granted");
      setError(null);
      return true;
    } catch {
      setPermission("denied");
      setError(describeSpeechError("not-allowed"));
      return false;
    }
  }, []);

  const attachHandlers = useCallback(
    (recognition: InstanceType<SpeechRecognitionCtor>) => {
      recognition.onstart = () => {
        restartCountRef.current = 0;
        setStatus("listening");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const now = Date.now();
        if (timingRef.current.firstSpeechAt === null) {
          timingRef.current.firstSpeechAt = now;
        }
        timingRef.current.lastSpeechAt = now;

        let newlyFinal = "";
        let stillInterim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) newlyFinal += text;
          else stillInterim += text;
        }

        if (newlyFinal) {
          // Accumulate rather than replace: this is what lets a candidate pause
          // mid-thought without losing the first half of their answer.
          transcriptRef.current = `${transcriptRef.current} ${newlyFinal}`
            .replace(/\s+/g, " ")
            .trim();
          setTranscript(transcriptRef.current);
        }
        setInterim(stillInterim);

        // Any speech resets the countdown to submit.
        armSilenceTimer();
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "no-speech" and "aborted" are routine during a long answer; surfacing
        // them as errors would be noise.
        if (event.error === "no-speech" || event.error === "aborted") return;

        setError(describeSpeechError(event.error));
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setPermission("denied");
          shouldListenRef.current = false;
          setStatus("stopped");
        }
      };

      recognition.onend = () => {
        // Chrome ends recognition on its own after silence or ~60s. If the
        // candidate is still answering, transparently restart so their answer
        // isn't cut in half.
        if (!shouldListenRef.current) {
          setStatus("stopped");
          return;
        }
        if (restartCountRef.current >= 12) {
          setError(
            "Speech recognition kept dropping. You can type your answer instead."
          );
          shouldListenRef.current = false;
          setStatus("stopped");
          return;
        }
        restartCountRef.current += 1;
        try {
          recognition.start();
        } catch {
          /* start() throws if it's already running — safe to ignore */
        }
      };
    },
    [armSilenceTimer]
  );

  /** Begin (or restart) listening for a fresh answer. */
  const start = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setIsSupported(false);
      setError(
        "Speech recognition isn't supported in this browser. Use Chrome or Edge, or type your answer."
      );
      return false;
    }

    setStatus("starting");
    setError(null);

    // Reset per-answer state before the permission check, so a candidate
    // typing because the mic is blocked starts from an empty box rather than
    // their previous answer.
    transcriptRef.current = "";
    setTranscript("");
    setInterim("");
    timingRef.current = {
      startedAt: Date.now(),
      firstSpeechAt: null,
      lastSpeechAt: null,
    };
    restartCountRef.current = 0;
    finalizedRef.current = false;
    clearSilenceTimer();

    const ok = await ensurePermission();
    if (!ok) {
      setStatus("stopped");
      return false;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true; // survive natural pauses
    recognition.interimResults = true; // live feedback + hesitation timing
    recognition.maxAlternatives = 1;
    attachHandlers(recognition);

    recognitionRef.current = recognition;
    shouldListenRef.current = true;

    try {
      recognition.start();
      return true;
    } catch {
      // Already running: treat as success rather than failing the turn.
      setStatus("listening");
      return true;
    }
  }, [attachHandlers, clearSilenceTimer, ensurePermission, lang]);

  /** Submit whatever has been captured so far. */
  const stop = useCallback(() => finalize(), [finalize]);

  /**
   * Prepare for a typed answer when speech is unavailable, so the candidate is
   * never blocked from responding.
   */
  const beginTypedAnswer = useCallback(() => {
    transcriptRef.current = "";
    setTranscript("");
    setInterim("");
    timingRef.current = {
      startedAt: Date.now(),
      firstSpeechAt: null,
      lastSpeechAt: null,
    };
    finalizedRef.current = false;
    shouldListenRef.current = false;
    setStatus("stopped");
  }, []);

  /**
   * Put a submitted answer back in the box so it can be sent again — used when
   * the submit itself failed. Without this, finalize()'s once-per-answer guard
   * would swallow the retry.
   */
  const reopen = useCallback(
    (text: string) => {
      shouldListenRef.current = false;
      clearSilenceTimer();
      transcriptRef.current = text;
      setTranscript(text);
      setInterim("");
      finalizedRef.current = false;
      setStatus("stopped");
    },
    [clearSilenceTimer]
  );

  /** Abort without submitting (used when the interview ends or unmounts). */
  const cancel = useCallback(() => {
    shouldListenRef.current = false;
    clearSilenceTimer();
    try {
      recognitionRef.current?.abort();
    } catch {
      /* nothing to abort */
    }
    setStatus("idle");
    setInterim("");
  }, [clearSilenceTimer]);

  /** Let the candidate correct a mis-heard answer before it's submitted. */
  const editTranscript = useCallback(
    (value: string) => {
      transcriptRef.current = value;
      setTranscript(value);
      // Editing means they're still working — don't submit out from under them.
      clearSilenceTimer();
    },
    [clearSilenceTimer]
  );

  useEffect(
    () => () => {
      shouldListenRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {
        /* nothing to abort */
      }
    },
    []
  );

  return {
    isSupported,
    status,
    permission,
    transcript,
    interim,
    error,
    pendingAutoSubmit,
    start,
    stop,
    cancel,
    reopen,
    beginTypedAnswer,
    editTranscript,
    clearError: useCallback(() => setError(null), []),
  };
}
