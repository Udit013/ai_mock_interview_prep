"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createFeedback } from "@/lib/actions/interview.action";
import {
  analyzeSpeaking,
  countFillerWords,
  wordCount,
} from "@/lib/analytics/speaking";
import {
  useSpeechRecognition,
  type SpeechTiming,
} from "@/hooks/useSpeechRecognition";

// Mirrors DeliverySignals in lib/ai/adaptive.ts (kept local: no server imports).
interface DeliverySignalsPayload {
  hesitationSeconds: number;
  answerSeconds: number;
  wordCount: number;
  fillerCount: number;
}

// Local copy so this client component never imports server-only AI libs.
const DEFAULT_INTERVIEW_STATE: InterviewState = {
  strengths: [],
  weaknesses: [],
  topicsCovered: [],
  estimatedConfidence: 50,
  difficulty: "medium",
  followUpOpportunities: [],
};

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(n, lo), hi);

/** Turn raw mic timing into the delivery profile the interviewer reacts to. */
function signalsFromTiming(
  text: string,
  timing: SpeechTiming
): DeliverySignalsPayload {
  const end = timing.lastSpeechAt ?? Date.now();
  const spokeAt = timing.firstSpeechAt ?? end;
  return {
    hesitationSeconds: clamp((spokeAt - timing.startedAt) / 1000, 0, 120),
    answerSeconds: clamp((end - spokeAt) / 1000, 0, 600),
    wordCount: wordCount(text),
    fillerCount: countFillerWords(text).total,
  };
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions = [],
  role,
  level,
  interviewType,
  companyMode,
  getCodeContext,
  compact = false,
  onActiveChange,
  onActiveQuestionChange,
}: AgentProps) => {
  const isCoding = interviewType === "Coding";
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [lastMessage, setLastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs so callbacks always see latest values without re-registering.
  const messagesRef = useRef<SavedMessage[]>([]);
  const interviewStateRef = useRef<InterviewState>(DEFAULT_INTERVIEW_STATE);
  const exchangeCountRef = useRef(0);
  const activeQuestionIndexRef = useRef(0);
  const answerDurationsRef = useRef<number[]>([]);
  const spokenTurnsRef = useRef<string[]>([]);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const statusRef = useRef<CallStatus>(CallStatus.INACTIVE);
  /** Indirection so the speech hook can call the latest handler. */
  const answerHandlerRef = useRef<
    (text: string, signals: DeliverySignalsPayload | null) => void
  >(() => {});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    statusRef.current = callStatus;
    onActiveChange?.(callStatus === CallStatus.ACTIVE);
  }, [callStatus, onActiveChange]);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  // ── Text-to-Speech ──────────────────────────────────────────────────────────
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const loadVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Samantha") ||
              v.name.includes("Karen") ||
              v.name.includes("Daniel") ||
              v.name.includes("Google US English") ||
              v.name.includes("Microsoft Aria"))
        );
        if (preferred) utterance.voice = preferred;
      };

      if (window.speechSynthesis.getVoices().length > 0) loadVoice();
      else window.speechSynthesis.onvoiceschanged = loadVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        synthRef.current = null;
        resolve();
      };
      // Resolve (not reject) on error so a TTS failure never stalls the loop.
      utterance.onerror = () => {
        setIsSpeaking(false);
        synthRef.current = null;
        resolve();
      };

      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ── Speech-to-text ──────────────────────────────────────────────────────────
  const speech = useSpeechRecognition({
    onFinalize: useCallback((text: string, timing: SpeechTiming) => {
      if (!text.trim()) return; // nothing captured — keep waiting
      answerHandlerRef.current(text, signalsFromTiming(text, timing));
    }, []),
  });

  const { start: startListening, cancel: cancelListening } = speech;

  // ── Core interview conversation loop ────────────────────────────────────────
  const handleUserAnswer = useCallback(
    async (userAnswer: string, signals: DeliverySignalsPayload | null) => {
      if (!userAnswer || statusRef.current !== CallStatus.ACTIVE) return;

      if (signals) {
        spokenTurnsRef.current.push(userAnswer);
        answerDurationsRef.current.push(signals.answerSeconds);
      }

      const userMsg: SavedMessage = { role: "user", content: userAnswer };
      setMessages((prev) => [...prev, userMsg]);
      messagesRef.current = [...messagesRef.current, userMsg];

      setIsProcessing(true);
      setIsSubmitting(false);

      try {
        const res = await fetch("/api/interview/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: role ?? "the role",
            level: level ?? "",
            type: interviewType ?? "Mixed",
            questions,
            userAnswer,
            conversationHistory: messagesRef.current,
            interviewState: interviewStateRef.current,
            exchangeCount: exchangeCountRef.current,
            activeQuestionIndex: activeQuestionIndexRef.current,
            deliverySignals: signals ?? undefined,
            companyMode,
            codeSubmission: getCodeContext?.() ?? undefined,
          }),
        });

        if (res.status === 429) {
          setIsProcessing(false);
          toast.error("You've hit today's interview limit. Try again tomorrow.");
          setCallStatus(CallStatus.FINISHED);
          return;
        }
        if (res.status === 401) {
          setIsProcessing(false);
          toast.error("Your session expired. Please sign in again.");
          router.push("/sign-in");
          return;
        }
        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        const aiMsg: SavedMessage = { role: "assistant", content: data.aiResponse };

        setMessages((prev) => [...prev, aiMsg]);
        messagesRef.current = [...messagesRef.current, aiMsg];

        if (data.interviewState) interviewStateRef.current = data.interviewState;
        if (typeof data.exchangeCount === "number") {
          exchangeCountRef.current = data.exchangeCount;
        }
        if (typeof data.activeQuestionIndex === "number") {
          activeQuestionIndexRef.current = data.activeQuestionIndex;
          onActiveQuestionChange?.(data.activeQuestionIndex);
        }

        setIsProcessing(false);
        await speakText(data.aiResponse);

        if (data.isFinished) {
          setCallStatus(CallStatus.FINISHED);
        } else if (statusRef.current === CallStatus.ACTIVE) {
          startListening();
        }
      } catch {
        setIsProcessing(false);
        toast.error(
          "Couldn't reach the interviewer. Check your connection — your answer is still here, press Send to retry."
        );
      }
    },
    [
      questions,
      role,
      level,
      interviewType,
      companyMode,
      getCodeContext,
      onActiveQuestionChange,
      router,
      speakText,
      startListening,
    ]
  );

  useEffect(() => {
    answerHandlerRef.current = handleUserAnswer;
  }, [handleUserAnswer]);

  /** Manual submit — also the only path when speech is unavailable. */
  const submitAnswer = useCallback(() => {
    if (!speech.transcript.trim() || isProcessing) return;
    setIsSubmitting(true);
    speech.stop();
  }, [speech, isProcessing]);

  // ── Coding interviews: explicit "review my code" requests ───────────────────
  useEffect(() => {
    if (!getCodeContext) return;
    const onSubmitCode = () => {
      if (statusRef.current !== CallStatus.ACTIVE) return;
      cancelListening();
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
      // A code submission isn't a spoken answer — pass no delivery signals so
      // the previous answer's profile doesn't colour the interviewer.
      answerHandlerRef.current(
        "I've just submitted my code for review — please take a look and share your thoughts.",
        null
      );
    };
    window.addEventListener("prepwise:submit-code", onSubmitCode);
    return () => window.removeEventListener("prepwise:submit-code", onSubmitCode);
  }, [getCodeContext, cancelListening]);

  // ── Finish: generate feedback and redirect ──────────────────────────────────
  useEffect(() => {
    if (callStatus !== CallStatus.FINISHED) return;
    if (type === "generate") {
      router.push("/");
      return;
    }

    const finish = async () => {
      cancelListening();
      const speakingAnalytics = analyzeSpeaking(
        spokenTurnsRef.current,
        answerDurationsRef.current
      );

      const { success, feedbackId: newFeedbackId } = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: messagesRef.current,
        feedbackId,
        speakingAnalytics,
        finalCode: getCodeContext?.() ?? undefined,
      });

      if (success && newFeedbackId) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        toast.error("Couldn't save your feedback. Returning to the dashboard.");
        router.push("/");
      }
    };

    finish();
  }, [callStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release the microphone and stop speech if the component unmounts mid-
  // interview (e.g. the user navigates away).
  useEffect(
    () => () => {
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
    },
    []
  );

  // ── Start interview ─────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setCallStatus(CallStatus.CONNECTING);
    messagesRef.current = [];
    interviewStateRef.current = DEFAULT_INTERVIEW_STATE;
    exchangeCountRef.current = 0;
    activeQuestionIndexRef.current = 0;
    answerDurationsRef.current = [];
    spokenTurnsRef.current = [];
    setMessages([]);

    // Coding rounds show the problem on screen, so never read it aloud.
    const spokenOpening = isCoding
      ? `Hi ${userName}, welcome. The problem is on your screen — take a moment to read it. ` +
        `When you're ready, walk me through your approach before you start coding.`
      : `Hello ${userName}! Welcome to your mock interview. ` +
        `I'll be asking you ${questions.length} ` +
        `${questions.length === 1 ? "question" : "questions"} today. ` +
        `Take your time with each answer. Let's get started. ` +
        `Here's your first question: ${questions[0] ?? ""}`;

    // The transcript still records the problem so feedback and replay have it.
    const recordedOpening = isCoding
      ? `${spokenOpening}\n\n[Problem shown on screen]: ${questions[0] ?? ""}`
      : spokenOpening;

    const openingMsg: SavedMessage = { role: "assistant", content: recordedOpening };
    setMessages([openingMsg]);
    messagesRef.current = [openingMsg];

    setCallStatus(CallStatus.ACTIVE);
    await speakText(spokenOpening);

    if (statusRef.current === CallStatus.ACTIVE) {
      const started = await startListening();
      // Speech unavailable or mic denied: fall back to typing so the candidate
      // is never stuck. The hook surfaces the reason in `speech.error`.
      if (!started) speech.beginTypedAnswer();
    }
  }, [userName, questions, isCoding, speakText, startListening, speech]);

  const handleEnd = useCallback(() => {
    cancelListening();
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    setCallStatus(CallStatus.FINISHED);
  }, [cancelListening]);

  // ── Derived UI state ────────────────────────────────────────────────────────
  const isActive = callStatus === CallStatus.ACTIVE;
  const isListening = speech.status === "listening";

  const statusLabel = isProcessing
    ? "Thinking…"
    : isSpeaking
    ? "Interviewer speaking"
    : speech.status === "starting"
    ? "Starting microphone…"
    : speech.pendingAutoSubmit
    ? "Sending your answer…"
    : isListening
    ? "Listening"
    : isActive
    ? "Your turn"
    : callStatus === CallStatus.CONNECTING
    ? "Connecting…"
    : callStatus === CallStatus.FINISHED
    ? "Interview complete"
    : "Not started";

  const displayText =
    lastMessage || (callStatus === CallStatus.CONNECTING ? "Connecting…" : "");

  /** The answer capture box: live transcript, editable, with explicit submit. */
  const answerPanel = isActive && !isSpeaking && !isProcessing && (
    <div className="flex flex-col gap-2 rounded-xl border border-dark-300 bg-dark-200/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          {isListening && (
            <span
              aria-hidden
              className="size-2.5 rounded-full bg-destructive-100 animate-pulse"
            />
          )}
          Your answer
        </span>
        <span className="text-xs text-light-400" aria-live="polite">
          {speech.pendingAutoSubmit
            ? "Sending shortly — keep talking or edit to cancel"
            : isListening
            ? "Listening… pause when you're done"
            : speech.isSupported
            ? "Type your answer"
            : "Speech unavailable — type your answer"}
        </span>
      </div>

      <label htmlFor="answer-box" className="sr-only">
        Your answer. Edit it if anything was misheard, then send.
      </label>
      <textarea
        id="answer-box"
        value={speech.transcript}
        onChange={(e) => speech.editTranscript(e.target.value)}
        rows={3}
        placeholder={
          isListening
            ? "Start speaking — your words will appear here."
            : "Type your answer here."
        }
        className="w-full resize-y rounded-lg border border-dark-300 bg-dark-300/50 p-3 text-sm leading-relaxed outline-none focus:border-primary-200"
      />

      {speech.interim && (
        <p className="text-xs italic text-light-400" aria-live="polite">
          {speech.interim}
        </p>
      )}

      {speech.error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive-100/10 px-3 py-2 text-xs text-destructive-100"
        >
          {speech.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submitAnswer}
          disabled={!speech.transcript.trim() || isSubmitting}
          className="btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-50"
        >
          {isSubmitting ? "Sending…" : "Send answer"}
        </button>
        <button
          type="button"
          onClick={() => speech.editTranscript("")}
          disabled={!speech.transcript}
          className="text-xs text-light-400 hover:text-white transition-colors disabled:opacity-40"
        >
          Clear
        </button>
        {!isListening && speech.isSupported && (
          <button
            type="button"
            onClick={() => startListening()}
            className="text-xs text-primary-100 hover:underline"
          >
            Restart microphone
          </button>
        )}
      </div>
    </div>
  );

  const controlButton =
    callStatus !== CallStatus.ACTIVE ? (
      <button
        className="relative btn-call"
        onClick={handleStart}
        disabled={
          callStatus === CallStatus.CONNECTING ||
          callStatus === CallStatus.FINISHED
        }
      >
        <span
          className={cn(
            "absolute animate-ping rounded-full opacity-75",
            callStatus !== CallStatus.CONNECTING && "hidden"
          )}
        />
        <span>
          {callStatus === CallStatus.FINISHED
            ? "Done"
            : callStatus === CallStatus.CONNECTING
            ? ". . ."
            : "Start Interview"}
        </span>
      </button>
    ) : (
      <button className="btn-disconnect" onClick={handleEnd}>
        End Interview
      </button>
    );

  // Compact layout: a slim voice bar for the split-screen coding interview.
  if (compact) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dark-300 bg-dark-200/40 p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Image
              src="/ai-avatar.png"
              alt=""
              width={40}
              height={40}
              className="rounded-full object-cover size-10 bg-dark-300 p-1.5"
            />
            {(isSpeaking || isProcessing) && (
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-primary-200 animate-pulse" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">AI Interviewer</p>
            <p className="text-xs text-light-400" aria-live="polite">
              {statusLabel}
            </p>
          </div>
        </div>

        {displayText && (
          <p className="max-h-28 overflow-y-auto rounded-lg bg-dark-300/50 p-3 text-sm leading-relaxed">
            {displayText}
          </p>
        )}

        {answerPanel}

        <div className="flex justify-center">{controlButton}</div>
      </div>
    );
  }

  return (
    <>
      <div className="call-view">
        {/* AI card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt=""
              width={65}
              height={54}
              className="object-cover"
            />
            {(isSpeaking || isProcessing) && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
          <p className="text-sm text-light-400 mt-1" aria-live="polite">
            {statusLabel}
          </p>
        </div>

        {/* User card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.svg"
              alt=""
              width={540}
              height={540}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
            {isListening && (
              <p className="text-sm text-success-100 mt-1 animate-pulse">
                🎤 Listening…
              </p>
            )}
          </div>
        </div>
      </div>

      {displayText && (
        <div className="transcript-border">
          <div className="transcript">
            <p key={displayText} className="transition-opacity duration-500 opacity-100">
              {displayText}
            </p>
          </div>
        </div>
      )}

      {answerPanel && <div className="w-full max-w-3xl mx-auto">{answerPanel}</div>}

      <div className="w-full flex justify-center">{controlButton}</div>
    </>
  );
};

export default Agent;
