"use client";

import { parseGridConfig } from "@/lib/blockly-worlds";
import { useReplayProgress } from "./use-replay-progress";

/**
 * A grid-world maze drawn from the same config the runtime reads from stdin (see parseGridConfig): walls,
 * the robot's start + facing, and the goal. With a `trace` (from wrapForWorldTrace) it becomes an animated
 * REPLAY: the robot steps through the maze and painted cells fill in. Without a trace it is the static
 * puzzle so the pupil can see what to solve. Warm palette only, no blue.
 */

type GridStep = { x: number; y: number; h: "E" | "S" | "W" | "N"; p: number };

function parseGridTrace(raw: string | null | undefined): { steps: GridStep[]; error: string | null } | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) return null;
    const steps: GridStep[] = parsed.steps
      .filter((s: unknown) => {
        const o = s as Record<string, unknown>;
        return o && typeof o.x === "number" && typeof o.y === "number" && typeof o.h === "string";
      })
      .map((s: Record<string, unknown>) => ({
        x: s.x as number,
        y: s.y as number,
        h: (["E", "S", "W", "N"].includes(s.h as string) ? s.h : "E") as GridStep["h"],
        p: Number(s.p) === 1 ? 1 : 0,
      }));
    return { steps, error: typeof parsed.error === "string" ? parsed.error : null };
  } catch {
    return null;
  }
}

const HEADING_DEG = { E: 0, S: 90, W: 180, N: 270 } as const;

export function GridWorldView({
  config,
  trace,
  runId = 0,
  className,
}: {
  config: string | null | undefined;
  trace?: string | null;
  runId?: number;
  className?: string;
}) {
  const grid = parseGridConfig(config ?? null);
  const replay = parseGridTrace(trace ?? null);
  const steps = replay?.steps ?? [];
  const progress = useReplayProgress(steps.length, runId);

  if (!grid) {
    return <p className={`text-xs text-stone-400 ${className ?? ""}`}>No maze to show yet.</p>;
  }

  const CELL = 34;
  const width = grid.cols * CELL;
  const height = grid.rows * CELL;

  const lines = [];
  for (let i = 0; i <= grid.cols; i += 1) {
    lines.push(<line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={height} stroke="#a8a29e" strokeOpacity={0.5} strokeWidth={1} />);
  }
  for (let j = 0; j <= grid.rows; j += 1) {
    lines.push(<line key={`h${j}`} x1={0} y1={j * CELL} x2={width} y2={j * CELL} stroke="#a8a29e" strokeOpacity={0.5} strokeWidth={1} />);
  }

  const walls = grid.walls
    .filter(([x, y]) => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows)
    .map(([x, y]) => <rect key={`w${x}-${y}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill="#57534e" />);

  const goalCell = grid.goal;

  // With a trace, the robot is at the current step and painted cells accrue; without one, show the start.
  const isReplay = steps.length > 0;
  const robot = isReplay ? steps[Math.min(progress, steps.length - 1)] : { x: grid.start[0], y: grid.start[1], h: grid.heading, p: 0 };
  const painted = isReplay
    ? steps.slice(0, Math.min(progress, steps.length - 1) + 1).filter((s) => s.p === 1).map((s) => `${s.x},${s.y}`)
    : [];
  const paintedSet = new Set(painted);

  const robotCx = robot.x * CELL + CELL / 2;
  const robotCy = robot.y * CELL + CELL / 2;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Maze, ${grid.cols} by ${grid.rows}`}
        style={{ width: "100%", maxWidth: Math.min(width, 320), height: "auto" }}
      >
        <rect x={0} y={0} width={width} height={height} fill="#faf8f5" />
        {Array.from(paintedSet).map((key) => {
          const [px, py] = key.split(",").map(Number);
          return <rect key={`p${key}`} x={px * CELL} y={py * CELL} width={CELL} height={CELL} fill="#B2401D" fillOpacity={0.3} />;
        })}
        {walls}
        {lines}
        {goalCell ? (
          <g>
            <rect x={goalCell[0] * CELL} y={goalCell[1] * CELL} width={CELL} height={CELL} fill="#B2401D" fillOpacity={0.15} />
            <circle cx={goalCell[0] * CELL + CELL / 2} cy={goalCell[1] * CELL + CELL / 2} r={9} fill="none" stroke="#B2401D" strokeWidth={3} />
            <circle cx={goalCell[0] * CELL + CELL / 2} cy={goalCell[1] * CELL + CELL / 2} r={3} fill="#B2401D" />
          </g>
        ) : null}
        <g transform={`rotate(${HEADING_DEG[robot.h]} ${robotCx} ${robotCy})`}>
          <circle cx={robotCx} cy={robotCy} r={11} fill="#2f6f4e" />
          <path d={`M ${robotCx - 4} ${robotCy - 5} L ${robotCx + 6} ${robotCy} L ${robotCx - 4} ${robotCy + 5} Z`} fill="#ffffff" />
        </g>
      </svg>
      {replay?.error ? (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Your robot stopped: {replay.error}</p>
      ) : null}
    </div>
  );
}
