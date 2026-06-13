# PrepWise — AI Mock Interview Platform

A full-stack AI-powered interview preparation platform that conducts real voice interviews, evaluates your performance with AI, and delivers structured feedback — entirely free, with no paid API dependencies.

## Live Demo

> Deploy to Vercel and add your URL here.

---

## Features

- **Voice Interview** — Browser-native speech recognition (Web Speech API) captures your answers; text-to-speech delivers AI questions aloud, creating a realistic interview experience with zero cost
- **AI Question Generation** — Gemini 2.0 Flash generates role-specific, leveled questions tailored to your tech stack and interview type (Technical / Behavioral / Mixed)
- **Conversational AI Interviewer** — After each answer, Gemini acknowledges your response, provides brief encouragement, and advances to the next question naturally
- **Detailed Feedback Report** — Scored across 5 dimensions (Communication, Technical Knowledge, Problem Solving, Cultural Fit, Confidence) with strengths, areas for improvement, and an overall assessment
- **Interview Dashboard** — View your past interviews and browse community interviews
- **Authentication** — Firebase Auth with email/password, session cookies, and protected routes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth & Database | Firebase (Auth + Firestore) |
| AI — Questions & Feedback | Google Gemini 2.0 Flash (`@ai-sdk/google`) |
| AI — Voice I/O | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Forms | react-hook-form + Zod |
| Deployment | Vercel |

**Cost: $0** — Gemini free tier + Firebase Spark plan + browser-native voice APIs.

---

## Architecture

```
app/
├── (auth)/          # Sign-in / Sign-up pages
├── (root)/
│   ├── page.tsx     # Dashboard (user + community interviews)
│   ├── interview/
│   │   ├── page.tsx          # Create interview form
│   │   ├── [id]/page.tsx     # Conduct interview (voice Agent)
│   │   └── [id]/feedback/    # AI-scored feedback report
│   └── layout.tsx   # Nav + auth guard
└── api/
    ├── vapi/generate/         # POST — Gemini generates questions
    └── interview/respond/     # POST — Gemini responds mid-interview

components/
├── Agent.tsx          # Voice interview engine (Web Speech API + Gemini)
├── InterviewForm.tsx  # Interview creation form
├── InterviewCard.tsx  # Dashboard interview cards
└── AuthForm.tsx       # Sign-in / Sign-up form

lib/
├── actions/
│   ├── interview.action.ts  # Firestore CRUD + Gemini feedback
│   └── auth.action.ts       # Session management
└── buffer-shim.js   # Node 22+ compatibility (replaces SlowBuffer)
```

---

## How the Voice Interview Works

1. **Start** — Agent speaks the opening and first question using `SpeechSynthesis`
2. **Listen** — `SpeechRecognition` captures the candidate's answer in real time (interim results shown as live transcript)
3. **Process** — Answer is sent to `/api/interview/respond`; Gemini acknowledges and asks the next question
4. **Repeat** — Loop continues until all questions are answered
5. **Finish** — `createFeedback` sends the full transcript to Gemini; structured feedback (Zod-validated) is saved to Firestore; user is redirected to the feedback page

---

## Local Setup

### Prerequisites

- Node.js 18+
- Firebase project (Firestore + Auth enabled)
- Google AI Studio API key (Gemini)

### Installation

```bash
git clone https://github.com/Udit013/ai_mock_interview_prep.git
cd ai_mock_interview_prep
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

GOOGLE_GENERATIVE_AI_API_KEY=AIza...
```

> Voice interviews use the browser-native Web Speech API — no additional API keys needed.

### Run

```bash
npm run dev   # http://localhost:3000
```

> Voice interview requires Chrome or Edge (Web Speech API).

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com/new)
3. Add all environment variables from `.env.local`
4. Deploy

Vercel auto-deploys on every push to `main`.

---

## Key Engineering Decisions

- **Firestore queries use single-field filters** to avoid composite index requirements; sorting and filtering happen client-side
- **Node 22+ compatibility** — `buffer-equal-constant-time` depends on `SlowBuffer` (removed in Node 22); solved with a webpack + Turbopack module alias pointing to a custom shim (`lib/buffer-shim.js`)
- **Web Speech API over paid STT/TTS** — Eliminates Vapi, ElevenLabs, and Deepgram costs entirely while keeping the interview experience natural

---

## Screenshots

_Add screenshots here after deployment._
