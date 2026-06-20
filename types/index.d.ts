// ── Web Speech API types (not in all TS lib versions) ──────────────────────
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// ── App domain types ─────────────────────────────────────────────────────────

interface Feedback {
  id: string;
  interviewId: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

interface Interview {
  id: string;
  role: string;
  level: string;
  questions: string[];
  techstack: string[];
  createdAt: string;
  userId: string;
  type: string;
  finalized: boolean;
  // Phase 1: optional, additive — older docs without it still load.
  source?: "manual" | "resume";
}

// ── Phase 1: Resume-Aware Interviews ──────────────────────────────────────────

interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
}

interface ResumeExperience {
  company: string;
  role: string;
  highlights: string[];
}

interface ParsedResume {
  summary: string;
  skills: string[];
  projects: ResumeProject[];
  experiences: ResumeExperience[];
  technologies: string[];
}

interface Resume extends ParsedResume {
  id: string;
  userId: string;
  rawTextLength: number;
  createdAt: string;
}

// ── Phase 2: Adaptive Interview Engine ────────────────────────────────────────

type InterviewDifficulty = "easy" | "medium" | "hard";

type AdaptiveAction =
  | "follow_up"
  | "increase_difficulty"
  | "probe_basics"
  | "clarify"
  | "next_topic"
  | "finish";

interface InterviewState {
  strengths: string[];
  weaknesses: string[];
  topicsCovered: string[];
  estimatedConfidence: number; // 0-100
  difficulty: InterviewDifficulty;
  followUpOpportunities: string[];
}

interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
}

interface User {
  name: string;
  email: string;
  id: string;
}

interface InterviewCardProps {
  interviewId?: string;
  userId?: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
}

interface AgentProps {
  userName: string;
  userId?: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

interface SignInParams {
  email: string;
  idToken: string;
}

interface SignUpParams {
  uid: string;
  name: string;
  email: string;
  password: string;
}

type FormType = "sign-in" | "sign-up";

interface InterviewFormProps {
  interviewId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  amount: number;
}

interface TechIconProps {
  techStack: string[];
}
