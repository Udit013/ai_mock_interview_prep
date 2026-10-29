import dayjs from 'dayjs';
import Image from "next/image";
import {cn} from "@/lib/utils";
import InterviewAvatar from "@/components/InterviewAvatar";
import InterviewCardMenu from "@/components/InterviewCardMenu";
import {Button} from "@/components/ui/button";
import Link from "next/link";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewCard = ({ interviewId, role, type, techstack, createdAt, feedback = null, visibility, companyName, isOwner = false, archived = false, collection, collections }: InterviewCardProps) => {
    const normalizedType = /mix/gi.test(type) ? 'Mixed' : type;
    const formattedDate = dayjs(feedback?.createdAt || createdAt || Date.now()).format('MMM D, YYYY');
    const isPrivate = visibility === 'private';

    return (
        <article className="card-border w-full min-h-96">
            <div className="card-interview">
              <div>
                  <div className="absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg bg-light-600">
                      <p className="badge-text">{normalizedType}</p>
                  </div>

                  <InterviewAvatar company={companyName} role={role} />

                  <div className="mt-3 flex min-h-11 flex-wrap items-center gap-2">
                      {visibility && (
                          <span
                              className={cn(
                                  "inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
                                  isPrivate
                                      ? "bg-dark-300 text-light-400"
                                      : "bg-success-100/20 text-success-100"
                              )}
                          >
                              <span aria-hidden="true">{isPrivate ? "🔒" : "🌐"}</span>
                              {isPrivate ? "Private" : "Public"}
                          </span>
                      )}
                      {collection && (
                          <span className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full border border-primary-200/25 bg-primary-200/10 px-3 py-1 text-xs font-medium text-primary-100">
                              <span aria-hidden="true">▤</span>
                              <span className="sr-only">Collection:</span>
                              {collection}
                          </span>
                      )}
                      {archived && (
                          <span className="inline-flex items-center rounded-full bg-dark-300 px-3 py-1 text-xs font-medium text-light-400">
                              Archived
                          </span>
                      )}
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

                  <h3 className="mt-5 capitalize">
                      {role} Interview
                  </h3>
                  {companyName && (
                      <p className="mt-1 text-sm text-light-400">at {companyName}</p>
                  )}

                  <div className="flex flex-row gap-5 mt-3">
                      <div className="flex flex-row gap-2">
                          <Image src="/calendar.svg" alt="" width={22} height={22} />
                          <span className="sr-only">Date:</span>
                          <p>{formattedDate}</p>
                      </div>

                      <div className="flex flex-row gap-2 items-center">
               <Image src="/star.svg" alt="" width={22} height={22} />
                          <span className="sr-only">Score:</span>
                          <p>{feedback?.totalScore ?? '---'}/100</p>
                      </div>
                  </div>

                  <p className="line-clamp-2 mt-5">
                      {feedback?.finalAssessment || "You haven't taken the interview yet. Take it now to improve your skills."}
                  </p>
              </div>

                <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <DisplayTechIcons techStack={techstack} />

                    <Button asChild className="btn-primary">
                        <Link href={feedback
                            ? `/interview/${interviewId}/feedback`
                            : `/interview/${interviewId}`
                        }>
                            {feedback ? 'Check Feedback' : 'View Interview'}
                        </Link>
                    </Button>
                </div>
            </div>
        </article>
    )
}
export default InterviewCard
