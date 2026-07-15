"use client";

import { useCallback, useRef, useState } from "react";
import Agent from "@/components/Agent";
import CodingPanel, { type CodingLanguage } from "@/components/CodingPanel";

export const CODE_SUBMIT_EVENT = "prepwise:submit-code";

interface CodingInterviewProps {
  userName: string;
  userId: string;
  interviewId: string;
  feedbackId?: string;
  questions: string[];
  role: string;
  level: string;
  companyMode?: string;
}

/**
 * Composes the voice Agent with a live Monaco editor. The interviewer sees the
 * candidate's current code with every turn (like a shared CoderPad), and
 * "Submit code for review" asks for an explicit review pass.
 */
const CodingInterview = (props: CodingInterviewProps) => {
  const codeRef = useRef("");
  const languageRef = useRef<CodingLanguage>("javascript");
  const [language, setLanguage] = useState<CodingLanguage>("javascript");

  const getCodeContext = useCallback(() => {
    // Ignore untouched starter comments — no signal for the interviewer.
    const substantive = codeRef.current
      .replace(/^\s*(\/\/|#).*$/gm, "")
      .trim();
    if (substantive.length < 10) return null;
    return {
      language: languageRef.current,
      code: codeRef.current.slice(0, 20_000),
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] items-start">
      {/* Agent renders a fragment; wrap it so it stays one grid item. */}
      <div className="flex flex-col gap-6">
        <Agent
          userName={props.userName}
          userId={props.userId}
          interviewId={props.interviewId}
          feedbackId={props.feedbackId}
          type="interview"
          questions={props.questions}
          role={props.role}
          level={props.level}
          interviewType="Coding"
          companyMode={props.companyMode}
          getCodeContext={getCodeContext}
        />
      </div>

      <CodingPanel
        language={language}
        onLanguageChange={(l) => {
          setLanguage(l);
          languageRef.current = l;
        }}
        onCodeChange={(code) => {
          codeRef.current = code;
        }}
        onSubmit={() => {
          window.dispatchEvent(new CustomEvent(CODE_SUBMIT_EVENT));
        }}
        submitDisabled={false}
      />
    </div>
  );
};

export default CodingInterview;
