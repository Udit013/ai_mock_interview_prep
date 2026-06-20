# PrepWise — AI Interview Intelligence Platform

A full-stack, AI-powered interview platform that conducts **adaptive voice interviews**, generates questions from your **résumé**, analyzes your **speaking delivery**, and tracks your **progress over time** — entirely free, with no paid API dependencies.

## Live Demo

**[https://mock-ai-prep.vercel.app](https://mock-ai-prep.vercel.app)**

> Voice interviews require Chrome or Edge (Web Speech API).

---

## Features

### Core
- **Adaptive Voice Interview** — Browser-native speech recognition captures your answers and text-to-speech asks questions aloud. The interviewer **adapts in real time**: strong answers raise difficulty, weak answers trigger follow-ups, missing fundamentals get probed, and unclear answers get clarifying questions.
- **AI Question Generation** — Gemini generates role-specific, leveled questions tailored to your tech stack and interview type (Technical / Behavioral / Mixed).
- **AI Feedback Report** — Scored across 5 dimensions (Communication, Technical Knowledge, Problem Solving, Cultural Fit, Confidence) with strengths, areas for improvement, STAR-method completeness, and an overall assessment — all Zod-validated.

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

### Auth
- Firebase Auth with email/password, server-side session cookies, and protected routes.

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
├── InterviewForm.tsx             # Manual / résumé modes + visibility toggle
├── InterviewCard.tsx             # Cards with score + visibility badge
└── dashboard/ProgressOverview.tsx# SVG stat cards / trend / competency bars

lib/
├── ai/
│   ├── resume.ts                 # résumé Zod schema + Gemini structuring
│   └── adaptive.ts               # interview state + adaptive turn engine
├── analytics/speaking.ts         # deterministic speaking metrics
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
- **Dependency-free charts** — the progress dashboard uses hand-built SVG, adding zero client JS.
- **Privacy by default for résumé interviews** — `visibility` filtering keeps personal interviews out of the community feed; older docs without the field remain public for backward compatibility.
- **Index-free Firestore queries** — single-field `where` filters with client-side sort/filter avoid composite-index requirements.
- **Node 22+ compatibility** — `buffer-equal-constant-time` references `SlowBuffer` (removed in Node 22); resolved via a webpack + Turbopack alias to `lib/buffer-shim.js`.

---

## Migration Notes
All schema changes are **additive and backward-compatible**:
- `Interview.source` and `Interview.visibility` are optional; existing docs without them load fine (treated as public, manual).
- `Feedback.speakingAnalytics` and `Feedback.starCompleteness` are optional; older feedback renders without those sections.
- New collection `resumes/{uid}` is created on first résumé upload.

No environment variables were added.

---

## Screenshots
Visit the live app at **[https://mock-ai-prep.vercel.app](https://mock-ai-prep.vercel.app)** to see it in action.
