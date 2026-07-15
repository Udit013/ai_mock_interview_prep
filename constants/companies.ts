/**
 * Config-driven company interview templates. Each mode customizes prompting,
 * interviewer behavior, and evaluation emphasis — one registry, no duplicated
 * logic across routes.
 */

export interface CompanyMode {
  id: string;
  name: string;
  category: "software" | "consulting";
  /** How the interviewer carries themselves. */
  interviewerStyle: string;
  /** What the questions should emphasize. */
  questionGuidance: string;
  /** What the feedback report should weigh most heavily. */
  evaluationEmphasis: string;
}

export const COMPANY_MODES: Record<string, CompanyMode> = {
  google: {
    id: "google",
    name: "Google",
    category: "software",
    interviewerStyle:
      "Calm and intellectually curious. Push for reasoning from first principles; ask 'why' repeatedly and explore generalizations of the problem.",
    questionGuidance:
      "Emphasize problem-solving depth, algorithmic reasoning, ambiguity handling, and scalable thinking. Prefer open-ended problems with several valid paths.",
    evaluationEmphasis:
      "Weight problem-solving depth and reasoning quality most heavily ('Googleyness': intellectual humility, collaboration).",
  },
  amazon: {
    id: "amazon",
    name: "Amazon",
    category: "software",
    interviewerStyle:
      "Direct and data-driven. Repeatedly ask for specific metrics, dates, and the candidate's personal contribution ('what did YOU do?').",
    questionGuidance:
      "Anchor questions in Amazon's Leadership Principles (Ownership, Customer Obsession, Dive Deep, Bias for Action, Deliver Results). Demand concrete examples with measurable outcomes.",
    evaluationEmphasis:
      "Weight Leadership Principles evidence most heavily: ownership, customer focus, measurable results, and depth of personal contribution.",
  },
  meta: {
    id: "meta",
    name: "Meta",
    category: "software",
    interviewerStyle:
      "Fast-paced and pragmatic. Value speed of iteration; challenge the candidate on practical trade-offs and 'what would you actually ship?'.",
    questionGuidance:
      "Emphasize execution speed, practical trade-offs, product sense, and impact at scale. Prefer scenarios about shipping under constraints.",
    evaluationEmphasis:
      "Weight execution ability and pragmatic trade-off reasoning most heavily; reward candidates who move fast without hand-waving.",
  },
  microsoft: {
    id: "microsoft",
    name: "Microsoft",
    category: "software",
    interviewerStyle:
      "Collaborative and growth-minded. Explore how the candidate learns, mentors others, and handles setbacks.",
    questionGuidance:
      "Emphasize growth mindset, collaboration across teams, customer empathy, and technical fundamentals.",
    evaluationEmphasis:
      "Weight learning agility, collaboration, and solid fundamentals most heavily.",
  },
  stripe: {
    id: "stripe",
    name: "Stripe",
    category: "software",
    interviewerStyle:
      "Precise and detail-obsessed. Probe rigor: edge cases, API design taste, and clarity of written/spoken communication.",
    questionGuidance:
      "Emphasize meticulous craft: API design, correctness, edge-case handling, and clear technical communication. Users-first framing.",
    evaluationEmphasis:
      "Weight rigor, attention to detail, and communication clarity most heavily.",
  },
  mckinsey: {
    id: "mckinsey",
    name: "McKinsey",
    category: "consulting",
    interviewerStyle:
      "Formal PEI (Personal Experience Interview) style. Drill deeply into ONE story at a time: what exactly happened, what the candidate personally did, and why.",
    questionGuidance:
      "PEI-style behavioral probing: personal impact, entrepreneurial drive, and leadership in adversity. Keep returning to the same story for more depth rather than moving on.",
    evaluationEmphasis:
      "Weight structured storytelling, personal impact, and depth-under-probing most heavily.",
  },
  bain: {
    id: "bain",
    name: "Bain",
    category: "consulting",
    interviewerStyle:
      "Warm but rigorous. Focus on team dynamics and measurable impact; ask how others would describe the candidate.",
    questionGuidance:
      "Emphasize teamwork, leadership, and quantified impact. Ask for results in numbers and how the candidate influenced people without authority.",
    evaluationEmphasis:
      "Weight teamwork, leadership, and measurable impact most heavily.",
  },
  bcg: {
    id: "bcg",
    name: "BCG",
    category: "consulting",
    interviewerStyle:
      "Analytical and structured. Expect the candidate to frame answers with explicit structure before diving in.",
    questionGuidance:
      "Emphasize structured thinking (frameworks, MECE breakdowns), intellectual curiosity, and collaboration.",
    evaluationEmphasis:
      "Weight structure of thought and collaborative problem-solving most heavily.",
  },
  deloitte: {
    id: "deloitte",
    name: "Deloitte",
    category: "consulting",
    interviewerStyle:
      "Client-facing professional. Frame scenarios around stakeholders and clients; test composure and clarity.",
    questionGuidance:
      "Emphasize client communication, stakeholder management, and handling difficult client situations with professionalism.",
    evaluationEmphasis:
      "Weight client communication and stakeholder management most heavily.",
  },
};

export const COMPANY_MODE_IDS = Object.keys(COMPANY_MODES);

export function getCompanyMode(id?: string | null): CompanyMode | null {
  if (!id) return null;
  return COMPANY_MODES[id] ?? null;
}

/** Prompt block injected into generation / adaptive / feedback prompts. */
export function companyPromptBlock(id?: string | null): string {
  const mode = getCompanyMode(id);
  if (!mode) return "";
  return `
Company interview style — ${mode.name}:
- Interviewer persona: ${mode.interviewerStyle}
- Question emphasis: ${mode.questionGuidance}
- Evaluation emphasis: ${mode.evaluationEmphasis}
`;
}
