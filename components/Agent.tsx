"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createFeedback } from "@/lib/actions/interview.action";
import { analyzeSpeaking } from "@/lib/analytics/speaking";

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
}: AgentProps) => {
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
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const statusRef = useRef<CallStatus>(CallStatus.INACTIVE);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    statusRef.current = callStatus;
  }, [callStatus]);

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
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const interim = Array.from(event.results)
          .map((r: SpeechRecognitionResult) => r[0].transcript)
          .join("");
        setInterimTranscript(interim);

        if (event.results[event.results.length - 1].isFinal) {
          setInterimTranscript("");
          // Record how long this answer took, for speaking analytics.
          const seconds = (Date.now() - answerStartRef.current) / 1000;
          if (seconds > 0 && seconds < 600) {
            answerDurationsRef.current.push(seconds);
          }
          onResult(interim.trim());
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
    [questions, role, level, interviewType, speakText, startListening]
  );

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

    // Speak the opening + first question
    const opening =
      `Hello ${userName}! Welcome to your mock interview. ` +
      `I'll be asking you ${questions.length} questions today. ` +
      `Take your time with each answer. Let's get started. ` +
      `Here's your first question: ${questions[0]}`;

    const openingMsg: SavedMessage = {
      role: "assistant",
      content: opening,
    };
    setMessages([openingMsg]);
    messagesRef.current = [openingMsg];

    setCallStatus(CallStatus.ACTIVE);
    await speakText(opening);

    if (statusRef.current === CallStatus.ACTIVE) {
      startListening(handleUserAnswer);
    }
  }, [userName, questions, speakText, startListening, handleUserAnswer]);

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
              src="/user-avatar.png"
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

      <div className="w-full flex justify-center">
        {callStatus !== CallStatus.ACTIVE ? (
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
              {callStatus === CallStatus.FINISHED ? "Done" : callStatus === CallStatus.CONNECTING ? ". . ." : "Start"}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleEnd}>
            End Interview
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
