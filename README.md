# PrepWise — AI Interview Intelligence Platform

A full-stack, AI-powered interview platform that conducts **adaptive voice interviews** with a genuinely human interviewer — one that reacts to your **hesitation and confidence**, reviews your **live code**, adapts to **company-specific styles** — plus résumé-aware questions, speaking analytics, replay, shareable reports, and progress tracking. Entirely free, with no paid API dependencies.

## Live Demo

**[https://mock-ai-prep.vercel.app](https://mock-ai-prep.vercel.app)**

> Voice interviews require Chrome or Edge (Web Speech API).

---

## Features

### Core
- **Adaptive Voice Interview** — Browser-native speech recognition captures your answers and text-to-speech asks questions aloud. The interviewer **adapts in real time**: strong answers raise difficulty, weak answers trigger follow-ups, missing fundamentals get probed, and unclear answers get clarifying questions.
- **Human-like delivery awareness** — the browser measures how you answered (hesitation before speaking, pace, filler density, answer length) and the interviewer reacts like a person: long pauses get *"No worries, take your time"* and a gentler probe; composed, fast depth gets pushed harder. Delivery also feeds the interviewer's running confidence estimate.
- **Five interview formats** — Technical, Behavioral, Mixed, **System Design** (requirements → scale estimation → trade-offs → bottlenecks), and **Coding** with a live editor.
- **Live Coding Interviews (Monaco)** — a CoderPad-style split view: the problem statement and a compact voice interviewer on one side, VS Code's Monaco editor (JS/Python/Java/C++) on the other. The problem is always **read on screen, never recited aloud** — the interviewer refers to it in passing and moves straight to discussion. **Run** actually executes JavaScript and Python client-side in a terminable Web Worker sandbox (isolated from the DOM, killed on infinite loops instead of freezing the tab; Python runs on lazily-loaded Pyodide/WASM). **Submit code for review** triggers a spoken review that reads your real code, catches bugs, and probes complexity and testing — reliably gated so it only fires once the interview is live.
- **Company Interview Modes** — config-driven templates for Google, Amazon (Leadership Principles), Meta, Microsoft, Stripe, McKinsey (PEI), Bain, BCG, and Deloitte that shape the interviewer's persona, question emphasis, and evaluation criteria.
- **AI Feedback Report** — Scored across 5 dimensions (Communication, Technical Knowledge, Problem Solving, Cultural Fit, Confidence) with strengths, areas for improvement, STAR-method completeness, and an overall assessment — all Zod-validated.
- **Interview Replay** — every completed interview persists its transcript; watch it back as an animated chat timeline (play/pause/skip), including your submitted code for coding rounds. Owner-only.
- **Résumé Coach** — candid AI suggestions over your stored résumé: bullet rewrites (with `<X>` metric placeholders, never invented numbers), missing elements recruiters expect, ATS keywords, and prioritized advice.
- **Shareable Reports** — mint an unguessable read-only link to a feedback report (scores and feedback only — never your transcript or code) and revoke it anytime.

### Résumé-Aware Interviews
- Upload a **PDF résumé**; text is extracted with `unpdf` (serverless, no native deps) and structured by Gemini into skills, projects, experiences, and technologies.
- Questions reference your **actual experience** — e.g. *"Why did you choose DeBERTa over BERT in your Aphasia Detection project?"* or *"Walk me through the deployment architecture of RxFlow."*

### Speaking Analytics (no external speech APIs)
- Deterministic, browser-computed metrics: **filler-word count**, **words per minute**, **speaking duration**, total words, plus actionable coaching insights.
- **STAR-method completeness** for behavioral answers (Situation / Task / Action / Result), judged by the feedback model.

### Progress Dashboard
- Personal coaching hub: interviews completed, **day streak**, average score, **score trend** (SVG line chart), per-competency averages (bars), strongest/weakest competencies, and recent improvement — all dependency-free.

### Privacy
- Every interview is **public or private**. Résumé interviews default to **private** and never appear in the community feed. A visibility badge (🔒 Private / 🌐 Public) is shown on each interview card.

### Auth & Production Hardening
- Firebase Auth with email/password, server-side session cookies, and protected routes.
- **All AI endpoints require a valid session** — identity is derived server-side from the session cookie, never from the request body — and every request body is **Zod-validated with size bounds**.
- **Per-user daily rate limits** on Gemini-backed endpoints (question generation, interview turns, résumé parsing) via a transactional Firestore counter — serverless-safe, no external services.
- **Owner-only access to private interviews**, enforced on direct URLs as well as the community feed; résumé uploads capped at 5 MB.
- **Unit tests (Vitest) + GitHub Actions CI** covering the deterministic core: speaking analytics, the adaptive engine's termination cap, schema validation, and the résumé guard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Auth & Database | Firebase (Auth + Firestore) |
| AI | Google **Gemini 2.5 Flash** (`@ai-sdk/google`, Vercel AI SDK) |
| Voice I/O | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Code editor | Monaco (`@monaco-editor/react`, lazy-loaded on the coding page only) |
| Code execution | In-browser Web Worker sandbox (JS) + Pyodide/WASM (Python), lazy-loaded |
| PDF parsing | `unpdf` |
| Validation | Zod (all AI outputs) |
| Forms | react-hook-form |
| Charts | Hand-built SVG (no chart library) |
| Deployment | Vercel |

**Cost: $0** — Gemini free tier + Firebase Spark plan + browser-native voice APIs.

> **Model note:** the code uses `gemini-2.5-flash`. Newer Google AI Studio keys have **zero free-tier quota for `gemini-2.0-flash`**, so 2.5 Flash is both the working and the more capable choice.

---

## Architecture

```
app/
├── (auth)/                       # Sign-in / Sign-up
├── (root)/
│   ├── page.tsx                  # Dashboard: progress hub + interviews
│   ├── interview/
│   │   ├── page.tsx              # Create interview (manual or résumé)
│   │   ├── [id]/page.tsx         # Conduct adaptive voice interview
│   │   └── [id]/feedback/        # Feedback + speaking analytics + STAR
│   └── layout.tsx                # Nav + auth guard
└── api/
    ├── vapi/generate/            # POST — generate questions (manual/résumé)
    ├── interview/respond/        # POST — adaptive interview turn
    └── resume/parse/             # POST — PDF → structured résumé

components/
├── Agent.tsx                     # Voice engine (Web Speech API) + adaptive loop
│                                  #   (compact mode for the split coding layout)
├── CodingPanel.tsx                # Monaco editor + Run/Submit + output console
├── ProblemPanel.tsx               # On-screen problem statement (never recited)
├── InterviewForm.tsx             # Manual / résumé modes + visibility toggle
├── InterviewCard.tsx             # Cards with score + visibility badge
└── dashboard/ProgressOverview.tsx# SVG stat cards / trend / competency bars

lib/
├── ai/
│   ├── resume.ts                 # résumé Zod schema + Gemini structuring
│   └── adaptive.ts               # interview state + adaptive turn engine
├── analytics/speaking.ts         # deterministic speaking metrics
├── runner/code-runner.ts         # Web Worker + Pyodide sandbox (terminable)
├── actions/
│   ├── interview.action.ts       # Firestore CRUD + Gemini feedback
│   ├── analytics.action.ts       # progress aggregation
│   ├── resume.action.ts          # résumé persistence
│   └── auth.action.ts            # session management
└── buffer-shim.js                # Node 22+ compatibility (replaces SlowBuffer)
```

### Firestore collections
- `users/{uid}` — profile
- `interviews/{id}` — `{ role, level, type, questions, techstack, userId, finalized, source, visibility, createdAt }`
- `resumes/{uid}` — latest structured résumé per user
- `feedback/{id}` — scores, strengths, STAR completeness, speaking analytics

---

## How the Adaptive Interview Works

1. **Start** — the Agent speaks an opening and the first seed question via `SpeechSynthesis`.
2. **Listen** — `SpeechRecognition` captures the answer (with live interim transcript) and times its duration.
3. **Adapt** — the answer is sent to `/api/interview/respond`, which runs one Zod-validated Gemini call that evaluates depth, updates a running `InterviewState` (strengths, weaknesses, topics, confidence, difficulty), and picks the next action: `follow_up | increase_difficulty | probe_basics | clarify | next_topic | finish`.
4. **Terminate** — a deterministic exchange cap (`min(seedQuestions + 4, 12)`) guarantees the interview always ends, regardless of model output.
5. **Finish** — the browser computes speaking analytics; `createFeedback` sends the transcript to Gemini for scoring + STAR analysis and stores everything in Firestore; the user is redirected to the feedback page.

---

## Local Setup

### Prerequisites
- Node.js 18+
- A Firebase project (Firestore + Auth enabled)
- A Google AI Studio API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free)

### Installation
```bash
git clone https://github.com/Udit013/ai_mock_interview_prep.git
cd ai_mock_interview_prep
npm install
```

### Environment Variables
Create `.env.local` with the four server-side variables (the Firebase **client** config is set in `firebase/client.ts`):

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key
```

> `.env.local` is gitignored. Voice and PDF parsing need no extra keys.

### Run
```bash
npm run dev   # http://localhost:3000
```

---

## Deployment (Vercel)
1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the four environment variables above (Production, Preview, Development).
3. Deploy. Vercel auto-deploys on every push to `main`.

---

## Key Engineering Decisions
- **Adaptive engine** — interview flow is server-driven via a single Zod-validated Gemini call per turn; seed questions form the backbone while difficulty and follow-ups adapt around them. Termination is enforced deterministically, never left to the model.
- **No server-only code in the client** — `Agent.tsx` keeps a local `InterviewState` default and imports only pure helpers, so AI SDK packages never enter the client bundle.
- **Deterministic analytics** — filler words / WPM / duration are computed in the browser (word-boundary safe), keeping coaching metrics free and explainable; only STAR judgment uses the model.
- **Terminable code execution** — code runs inside a Web Worker so an infinite loop can be killed (`worker.terminate()`) instead of hanging the tab; the same isolation means the sandbox never touches the DOM, cookies, or app state.
- **Dependency-free charts** — the progress dashboard uses hand-built SVG, adding zero client JS.
- **Privacy by default for résumé interviews** — `visibility` filtering keeps personal interviews out of the community feed; older docs without the field remain public for backward compatibility.
- **Index-free Firestore queries** — single-field `where` filters with client-side sort/filter avoid composite-index requirements.
- **Defense in depth on AI endpoints** — session-derived identity, Zod-bounded request bodies (prompt size can't be inflated by hostile payloads), and transactional per-user daily rate limits that fail open so a limiter outage never takes the product down.
- **Node 22+ compatibility** — `buffer-equal-constant-time` references `SlowBuffer` (removed in Node 22); resolved via a webpack + Turbopack alias to `lib/buffer-shim.js`.

---

## Migration Notes
All schema changes are **additive and backward-compatible**:
- `Interview.source`, `Interview.visibility`, and `Interview.companyMode` are optional; existing docs without them load fine (treated as public, manual, generic).
- `Feedback.speakingAnalytics`, `starCompleteness`, `transcript`, `finalCode`, and `shareToken` are optional; older feedback renders without those sections (no transcript → no replay link).
- New collections: `resumes/{uid}` (first résumé upload) and `rateLimits` (transactional daily counters).
- `adaptiveTurnSchema` gained `activeQuestionIndex` (server-computed, non-breaking) so the coding UI can track which problem the interviewer is discussing.

No environment variables were added. No database schema changes for the code-execution/layout update — it's entirely client-side.

## Deliberately Not Built
- **Barge-in interruptions** — the Web Speech recognizer picks up the app's own text-to-speech through the mic (no reliable echo cancellation), causing false triggers. Fake realism that degrades UX.
- **Leaderboards** — privacy-sensitive, gameable, and empty-looking at small scale.
- **Compiled-language execution (Java/C++)** — running these client-side would need a WASM toolchain far heavier than Pyodide for marginal benefit; the interviewer reviews Java/C++ code the way a human does instead, same as it always has for logic and correctness.

---

## Screenshots
Visit the live app at **[https://mock-ai-prep.vercel.app](https://mock-ai-prep.vercel.app)** to see it in action.
