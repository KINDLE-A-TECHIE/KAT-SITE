"use client";

import { useReplayProgress } from "./use-replay-progress";

/**
 * Animated replay of a turtle drawing, from the step trace the runtime emits (see wrapForWorldTrace). It
 * reveals the pen-down segments in the order they were drawn and shows the turtle at the current point.
 * World coordinates are math-style (y up); SVG is y-down, so y is flipped here, which is what makes
 * "turn right, go forward" head DOWNWARD on screen as a learner expects. Warm palette only.
 */

type TurtleStep = { x1: number; y1: number; x2: number; y2: number; pen: boolean };

function parseTurtleTrace(raw: string | null | undefined): { steps: TurtleStep[]; error: string | null } | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.steps)) return null;
    const steps: TurtleStep[] = parsed.steps
      .filter((s: unknown): s is TurtleStep => {
        const o = s as Record<string, unknown>;
        return o && [o.x1, o.y1, o.x2, o.y2].every((n) => typeof n === "number");
      })
      .map((s: TurtleStep) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, pen: Boolean(s.pen) }));
    return { steps, error: typeof parsed.error === "string" ? parsed.error : null };
  } catch {
    return null;
  }
}

export function TurtleWorldView({
  trace,
  runId = 0,
  className,
}: {
  trace?: string | null;
  runId?: number;
  className?: string;
}) {
  const data = parseTurtleTrace(trace ?? null);
  const steps = data?.steps ?? [];
  const progress = useReplayProgress(steps.length, runId);

  if (!data || steps.length === 0) {
    return <p className={`text-xs text-stone-400 ${className ?? ""}`}>Run your blocks to see the drawing.</p>;
  }

  const xs = steps.flatMap((s) => [s.x1, s.x2]).concat(0);
  const ys = steps.flatMap((s) => [s.y1, s.y2]).concat(0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const stroke = Math.max(1.5, Math.max(width, height) / 60);
  const pad = stroke * 3;

  // World (y up) -> SVG (y down): x shifts to 0, y flips about maxY.
  const sx = (x: number) => x - minX;
  const sy = (y: number) => maxY - y;

  const shown = steps.slice(0, progress + 1);
  const head = shown[shown.length - 1];
  const headX = sx(head.x2);
  const headY = sy(head.y2);

  return (
    <div className={className}>
      <svg
        viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Turtle drawing"
        style={{ width: "100%", maxWidth: 300, height: "auto", background: "#faf8f5", borderRadius: 8 }}
      >
        {shown
          .filter((s) => s.pen && !(s.x1 === s.x2 && s.y1 === s.y2))
          .map((s, i) => (
            <line
              key={i}
              x1={sx(s.x1)}
              y1={sy(s.y1)}
              x2={sx(s.x2)}
              y2={sy(s.y2)}
              stroke="#B2401D"
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          ))}
        <circle cx={headX} cy={headY} r={stroke * 1.8} fill="#2f6f4e" />
      </svg>
      {data.error ? (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">Your program stopped: {data.error}</p>
      ) : null}
    </div>
  );
}
