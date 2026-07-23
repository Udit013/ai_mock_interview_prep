"use client";

import { useCallback, useRef, useState } from "react";
import Agent from "@/components/Agent";
import CodingPanel, { type CodingLanguage } from "@/components/CodingPanel";
import ProblemPanel from "@/components/ProblemPanel";

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
 * Split-screen coding round: the problem and a slim voice bar on the left, the
 * editor and output console on the right. The interviewer sees the candidate's
 * current code with every turn, like a shared CoderPad.
 */
const CodingInterview = (props: CodingInterviewProps) => {
  const codeRef = useRef("");
  const languageRef = useRef<CodingLanguage>("javascript");
  const [language, setLanguage] = useState<CodingLanguage>("javascript");
  const [interviewActive, setInterviewActive] = useState(false);
  // Which problem is on screen — follows the interviewer, overridable by the
  // candidate via the problem selector.
  const [viewedIndex, setViewedIndex] = useState(0);

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

  // Keep the on-screen problem in step with whatever the interviewer moved to.
  const handleActiveQuestionChange = useCallback((index: number) => {
    setViewedIndex(index);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,26rem)_1fr] items-start">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <ProblemPanel
          questions={props.questions}
          activeIndex={viewedIndex}
          onSelect={setViewedIndex}
        />

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
          compact
          onActiveChange={setInterviewActive}
          onActiveQuestionChange={handleActiveQuestionChange}
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
        interviewActive={interviewActive}
      />
    </div>
  );
};

export default CodingInterview;
