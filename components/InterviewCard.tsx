import dayjs from "dayjs";
import Link from "next/link";
import { cn } from "@/lib/utils";
import InterviewAvatar from "@/components/InterviewAvatar";
import InterviewCardMenu from "@/components/InterviewCardMenu";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const scoreTone = (score: number) =>
  score >= 80 ? "text-success-100" : score >= 60 ? "text-warning" : "text-destructive-100";

/** Small, quiet metadata label. */
const Tag = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex max-w-[12rem] items-center gap-1 truncate rounded-md border border-line px-2 py-0.5 text-xs font-medium text-fg-muted",
      className
    )}
  >
    {children}
  </span>
);

const InterviewCard = ({
  interviewId,
  role,
  type,
  techstack,
  createdAt,
  feedback = null,
  visibility,
  companyName,
  isOwner = false,
  archived = false,
  collection,
  collections,
}: InterviewCardProps) => {
  const normalizedType = /mix/gi.test(type) ? "Mixed" : type;
  const formattedDate = dayjs(feedback?.createdAt || createdAt || Date.now()).format("MMM D, YYYY");
  const isPrivate = visibility === "private";
  const href = feedback ? `/interview/${interviewId}/feedback` : `/interview/${interviewId}`;

  return (
    <article className="card-border w-full">
      <div className="card-interview gap-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <InterviewAvatar company={companyName} role={role} size={44} />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold capitalize leading-snug">{role} interview</h3>
              <p className="mt-0.5 truncate text-sm text-fg-muted">
                {companyName ? `${companyName} · ` : ""}
                {formattedDate}
              </p>
            </div>
            {isOwner && interviewId && (
              <InterviewCardMenu
                interviewId={interviewId}
                role={role}
                archived={archived}
                collection={collection}
                collections={collections}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Tag>{normalizedType}</Tag>
            {visibility && <Tag>{isPrivate ? "Private" : "Public"}</Tag>}
            {collection && (
              <Tag className="text-fg-soft">
                <span className="sr-only">Collection:</span>
                {collection}
              </Tag>
            )}
            {archived && <Tag>Archived</Tag>}
          </div>

          <p className="line-clamp-2 text-sm leading-relaxed">
            {feedback?.finalAssessment ||
              "Not taken yet. Run it to get a scored breakdown of your answers."}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            {feedback ? (
              <p className="flex items-baseline gap-1">
                <span className="sr-only">Score:</span>
                <span className={cn("num text-xl font-semibold", scoreTone(feedback.totalScore))}>
                  {feedback.totalScore}
                </span>
                <span className="num text-xs text-fg-muted">/100</span>
              </p>
            ) : (
              <DisplayTechIcons techStack={techstack} />
            )}
          </div>
          <Link href={href} className="btn-secondary !min-h-9 !px-3 text-sm">
            {feedback ? "View feedback" : "Start"}
            <span className="sr-only"> — {role} interview</span>
          </Link>
        </div>
      </div>
    </article>
  );
};
export default InterviewCard;
