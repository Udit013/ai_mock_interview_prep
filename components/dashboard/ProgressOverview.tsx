import dayjs from "dayjs";
import { cn } from "@/lib/utils";

// Dependency-free SVG line chart of interview scores over time.
const ScoreTrend = ({ points }: { points: ScorePoint[] }) => {
  if (points.length === 0) return null;

  const width = 600;
  const height = 160;
  const padX = 24;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const x = (i: number) =>
    points.length === 1
      ? width / 2
      : padX + (i / (points.length - 1)) * innerW;
  const y = (score: number) => padY + (1 - score / 100) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.score)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Score trend over time"
    >
      {/* horizontal gridlines at 0/50/100 */}
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line
            x1={padX}
            x2={width - padX}
            y1={y(g)}
            y2={y(g)}
            stroke="currentColor"
            className="text-dark-300"
            strokeWidth={1}
          />
          <text
            x={4}
            y={y(g) + 4}
            className="fill-light-400"
            fontSize={10}
          >
            {g}
          </text>
        </g>
      ))}

      {points.length > 1 && (
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          className="text-primary-200"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(p.score)}
          r={3.5}
          className="fill-primary-100"
        >
          <title>
            {dayjs(p.date).format("MMM D, YYYY")}: {p.score}/100
          </title>
        </circle>
      ))}
    </svg>
  );
};

const CompetencyBars = ({ items }: { items: CompetencyScore[] }) => {
  if (items.length === 0) return null;
  const barColor = (score: number) =>
    score >= 80
      ? "bg-success-100"
      : score >= 60
      ? "bg-yellow-400"
      : "bg-destructive-100";

  return (
    <div className="flex flex-col gap-3">
      {items.map((c) => (
        <div key={c.name} className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>{c.name}</span>
            <span className="text-light-400">{c.score}/100</span>
          </div>
          <div className="w-full bg-dark-300 rounded-full h-2">
            <div
              className={cn("h-2 rounded-full", barColor(c.score))}
              style={{ width: `${c.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const StatCard = ({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) => (
  <div className="flex flex-col gap-1 rounded-lg border border-dark-300 bg-dark-200 px-5 py-4 min-w-[130px] flex-1">
    <span
      className={cn(
        "text-3xl font-bold",
        accent ? "text-primary-100" : "text-white"
      )}
    >
      {value}
    </span>
    <span className="text-xs text-light-400">{label}</span>
  </div>
);

const ProgressOverview = ({ progress }: { progress: UserProgress }) => {
  const {
    totalInterviews,
    averageScore,
    currentStreak,
    recentImprovement,
    scoreTrend,
    competencies,
    strongest,
    weakest,
  } = progress;

  const improvementLabel =
    recentImprovement === null
      ? "—"
      : `${recentImprovement >= 0 ? "+" : ""}${recentImprovement}`;

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-dark-300 bg-dark-200/40 p-6">
      <div className="flex flex-col gap-1">
        <h2>Your Progress</h2>
        <p className="text-light-400">
          Insights from your completed interviews.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <StatCard value={`${totalInterviews}`} label="Interviews completed" />
        <StatCard value={`${averageScore}`} label="Average score" accent />
        <StatCard
          value={`${currentStreak}🔥`}
          label={`Day streak`}
        />
        <StatCard
          value={improvementLabel}
          label="Recent improvement"
          accent={recentImprovement !== null && recentImprovement >= 0}
        />
      </div>

      {scoreTrend.length > 1 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg">Score trend</h3>
          <div className="text-primary-200">
            <ScoreTrend points={scoreTrend} />
          </div>
        </div>
      )}

      {competencies.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg">Competencies</h3>
          <CompetencyBars items={competencies} />
          {strongest && weakest && strongest.name !== weakest.name && (
            <p className="text-sm text-light-400">
              Strongest:{" "}
              <span className="text-success-100">{strongest.name}</span> ·
              Focus area:{" "}
              <span className="text-destructive-100">{weakest.name}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default ProgressOverview;
