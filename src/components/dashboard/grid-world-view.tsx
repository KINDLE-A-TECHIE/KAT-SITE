"use client";

import { parseGridConfig } from "@/lib/blockly-worlds";

/**
 * A static SVG picture of a grid-world maze, drawn from the same config the runtime reads from stdin (see
 * parseGridConfig). It shows the layout the pupil must solve: walls, the robot's start + facing, and the
 * goal. It is NOT a replay of the robot moving (that is the next increment); it just makes the puzzle
 * legible, since a maze is meaningless if you cannot see it. Warm palette only, no blue.
 */
export function GridWorldView({ config, className }: { config: string | null | undefined; className?: string }) {
  const grid = parseGridConfig(config ?? null);
  if (!grid) {
    return <p className={`text-xs text-stone-400 ${className ?? ""}`}>No maze to show yet.</p>;
  }

  const CELL = 34;
  const width = grid.cols * CELL;
  const height = grid.rows * CELL;
  const headingDeg = { E: 0, S: 90, W: 180, N: 270 }[grid.heading];

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
  const startX = grid.start[0] * CELL + CELL / 2;
  const startY = grid.start[1] * CELL + CELL / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Maze, ${grid.cols} by ${grid.rows}`}
      className={className}
      style={{ width: "100%", maxWidth: Math.min(width, 320), height: "auto" }}
    >
      <rect x={0} y={0} width={width} height={height} fill="#faf8f5" />
      {walls}
      {lines}
      {goalCell ? (
        <g>
          <rect x={goalCell[0] * CELL} y={goalCell[1] * CELL} width={CELL} height={CELL} fill="#B2401D" fillOpacity={0.15} />
          <circle cx={goalCell[0] * CELL + CELL / 2} cy={goalCell[1] * CELL + CELL / 2} r={9} fill="none" stroke="#B2401D" strokeWidth={3} />
          <circle cx={goalCell[0] * CELL + CELL / 2} cy={goalCell[1] * CELL + CELL / 2} r={3} fill="#B2401D" />
        </g>
      ) : null}
      <g transform={`rotate(${headingDeg} ${startX} ${startY})`}>
        <circle cx={startX} cy={startY} r={11} fill="#2f6f4e" />
        <path d={`M ${startX - 4} ${startY - 5} L ${startX + 6} ${startY} L ${startX - 4} ${startY + 5} Z`} fill="#ffffff" />
      </g>
    </svg>
  );
}
