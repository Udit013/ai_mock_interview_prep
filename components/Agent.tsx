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

type SpeechRecognitionCtor = new () => SpeechRecognition;

const getSpeechRecognition = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

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
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [lastMessage, setLastMessage] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  // Refs so callbacks always see latest values without re-registering
  const messagesRef = useRef<SavedMessage[]>([]);
  // Phase 2: adaptive engine state, carried across turns.
  const interviewStateRef = useRef<InterviewState>(DEFAULT_INTERVIEW_STATE);
  const exchangeCountRef = useRef(0);
  // Phase 4: per-answer speaking durations (seconds) for analytics.
  const answerStartRef = useRef(0);
  const answerDurationsRef = useRef<number[]>([]);
  // Realism: when the candidate actually started speaking (vs. listening start)
  // and the delivery profile of their last answer.
  const firstSpeechAtRef = useRef<number | null>(null);
  const lastSignalsRef = useRef<DeliverySignalsPayload | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const statusRef = useRef<CallStatus>(CallStatus.INACTIVE);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    statusRef.current = callStatus;
    // Let the coding layout enable/disable "Submit for review" correctly.
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
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Prefer a natural English voice
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

      if (window.speechSynthesis.getVoices().length > 0) {
        loadVoice();
      } else {
        window.speechSynthesis.onvoiceschanged = loadVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        synthRef.current = null;
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        synthRef.current = null;
        resolve();
      };

      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ── Speech-to-Text ──────────────────────────────────────────────────────────
  const startListening = useCallback(
    (onResult: (transcript: string) => void) => {
      const SpeechRec = getSpeechRecognition();
      if (!SpeechRec) {
        toast.error(
          "Speech recognition is not supported. Please use Chrome or Edge."
        );
        return;
      }

      const recognition = new SpeechRec();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        answerStartRef.current = Date.now();
        firstSpeechAtRef.current = null;
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (firstSpeechAtRef.current === null) {
          firstSpeechAtRef.current = Date.now();
        }
        const interim = Array.from(event.results)
          .map((r: SpeechRecognitionResult) => r[0].transcript)
          .join("");
        setInterimTranscript(interim);

        if (event.results[event.results.length - 1].isFinal) {
          setInterimTranscript("");
          const now = Date.now();
          // Record how long this answer took, for speaking analytics.
          const seconds = (now - answerStartRef.current) / 1000;
          if (seconds > 0 && seconds < 600) {
            answerDurationsRef.current.push(seconds);
          }

          // Delivery profile for the adaptive interviewer: how long they
          // hesitated before speaking, and how the answer was delivered.
          const text = interim.trim();
          const spokeAt = firstSpeechAtRef.current ?? now;
          lastSignalsRef.current = {
            hesitationSeconds: Math.min(
              Math.max((spokeAt - answerStartRef.current) / 1000, 0),
              120
            ),
            answerSeconds: Math.min(Math.max((now - spokeAt) / 1000, 0), 600),
            wordCount: wordCount(text),
            fillerCount: countFillerWords(text).total,
          };

          onResult(text);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          toast.error(`Microphone error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    },
    []
  );

  // ── Core interview conversation loop ────────────────────────────────────────
  const handleUserAnswer = useCallback(
    async (userAnswer: string) => {
      if (!userAnswer || statusRef.current !== CallStatus.ACTIVE) return;

      const userMsg: SavedMessage = { role: "user", content: userAnswer };
      setMessages((prev) => [...prev, userMsg]);
      messagesRef.current = [...messagesRef.current, userMsg];

      setIsProcessing(true);

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
            deliverySignals: lastSignalsRef.current ?? undefined,
            companyMode,
            codeSubmission: getCodeContext?.() ?? undefined,
          }),
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        const aiMsg: SavedMessage = {
          role: "assistant",
          content: data.aiResponse,
        };

        setMessages((prev) => [...prev, aiMsg]);
        messagesRef.current = [...messagesRef.current, aiMsg];

        // Carry the adaptive engine's updated assessment into the next turn.
        if (data.interviewState) interviewStateRef.current = data.interviewState;
        if (typeof data.exchangeCount === "number") {
          exchangeCountRef.current = data.exchangeCount;
        }
        if (typeof data.activeQuestionIndex === "number") {
          onActiveQuestionChange?.(data.activeQuestionIndex);
        }

        setIsProcessing(false);
        await speakText(data.aiResponse);

        if (data.isFinished) {
          setCallStatus(CallStatus.FINISHED);
        } else {
          startListening(handleUserAnswer);
        }
      } catch {
        setIsProcessing(false);
        toast.error("Connection error. Please check your internet.");
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
      speakText,
      startListening,
    ]
  );

  // ── Coding interviews: explicit "review my code" requests ───────────────────
  useEffect(() => {
    if (!getCodeContext) return;
    const onSubmitCode = () => {
      if (statusRef.current !== CallStatus.ACTIVE) return;
      // Stop listening/speaking and run a review turn with the current code.
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
      // A code submission isn't a spoken answer — don't let the previous
      // answer's delivery profile colour the interviewer's reaction.
      lastSignalsRef.current = null;
      handleUserAnswer(
        "I've just submitted my code for review — please take a look and share your thoughts."
      );
    };
    window.addEventListener("prepwise:submit-code", onSubmitCode);
    return () =>
      window.removeEventListener("prepwise:submit-code", onSubmitCode);
  }, [getCodeContext, handleUserAnswer]);

  // ── Finish: generate feedback and redirect ──────────────────────────────────
  useEffect(() => {
    if (callStatus !== CallStatus.FINISHED) return;
    if (type === "generate") {
      router.push("/");
      return;
    }

    const finish = async () => {
      // Phase 4: compute speaking analytics from the candidate's spoken turns.
      const candidateTurns = messagesRef.current
        .filter((m) => m.role === "user")
        .map((m) => m.content);
      const speakingAnalytics = analyzeSpeaking(
        candidateTurns,
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
        router.push("/");
      }
    };

    finish();
  }, [callStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start interview ─────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!getSpeechRecognition()) {
      toast.error(
        "Speech recognition requires Chrome or Edge. Please switch browsers."
      );
      return;
    }

    setCallStatus(CallStatus.CONNECTING);
    messagesRef.current = [];
    interviewStateRef.current = DEFAULT_INTERVIEW_STATE;
    exchangeCountRef.current = 0;
    answerDurationsRef.current = [];
    setMessages([]);

    // Coding rounds show the problem on screen, so never read it aloud.
    const spokenOpening = isCoding
      ? `Hi ${userName}, welcome. The problem is on your screen — take a moment to read it. ` +
        `When you're ready, walk me through your approach before you start coding.`
      : `Hello ${userName}! Welcome to your mock interview. ` +
        `I'll be asking you ${questions.length} questions today. ` +
        `Take your time with each answer. Let's get started. ` +
        `Here's your first question: ${questions[0]}`;

    // The transcript still records the problem so feedback and replay have it.
    const recordedOpening = isCoding
      ? `${spokenOpening}\n\n[Problem shown on screen]: ${questions[0] ?? ""}`
      : spokenOpening;

    const openingMsg: SavedMessage = {
      role: "assistant",
      content: recordedOpening,
    };
    setMessages([openingMsg]);
    messagesRef.current = [openingMsg];

    setCallStatus(CallStatus.ACTIVE);
    await speakText(spokenOpening);

    if (statusRef.current === CallStatus.ACTIVE) {
      startListening(handleUserAnswer);
    }
  }, [userName, questions, isCoding, speakText, startListening, handleUserAnswer]);

  // ── End interview early ──────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    recognitionRef.current?.abort();
    window.speechSynthesis.cancel();
    setCallStatus(CallStatus.FINISHED);
  }, []);

  const displayText =
    interimTranscript ||
    lastMessage ||
    (callStatus === CallStatus.CONNECTING ? "Connecting…" : "");

  const statusLabel = isProcessing
    ? "Thinking…"
    : isSpeaking
    ? "AI Speaking"
    : isListening
    ? "Listening…"
    : callStatus === CallStatus.ACTIVE
    ? "Your turn"
    : "";

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
            : "Start"}
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
              alt="AI Interviewer"
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
            <p className="text-xs text-light-400">
              {statusLabel || "Not started"}
            </p>
          </div>

          {isListening && (
            <span className="text-xs text-success-100 animate-pulse shrink-0">
              🎤 Listening
            </span>
          )}
        </div>

        {displayText && (
          <p
            key={displayText}
            className={cn(
              "max-h-28 overflow-y-auto rounded-lg bg-dark-300/50 p-3 text-sm leading-relaxed",
              interimTranscript && "italic text-light-400"
            )}
          >
            {displayText}
          </p>
        )}

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
              alt="AI Interviewer"
              width={65}
              height={54}
              className="object-cover"
            />
            {(isSpeaking || isProcessing) && (
              <span className="animate-speak" />
            )}
          </div>
          <h3>AI Interviewer</h3>
          {statusLabel && (
            <p className="text-sm text-light-400 mt-1">{statusLabel}</p>
          )}
        </div>

        {/* User card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.svg"
              alt="User avatar"
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
            <p
              key={displayText}
              className={cn(
                "transition-opacity duration-500 opacity-100",
                interimTranscript && "italic text-light-400"
              )}
            >
              {displayText}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">{controlButton}</div>
    </>
  );
};

export default Agent;
