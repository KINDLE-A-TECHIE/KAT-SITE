/**
 * "World" grading for block coding. A visual task ("draw a square", "reach the goal") has no natural
 * printout to compare, so a block world runs the pupil's generated Python against a tiny Python runtime
 * that RECORDS what the blocks did and prints a canonical JSON of the final state. That JSON is an
 * ordinary stdout string, so the existing CODE grader (client runs, server compares to a hidden
 * expectedStdout via matchOutput) scores it with no change to the grader, the route, or the schema.
 *
 * This file is PURE (no Blockly, no DOM), so wrapForWorld is unit-testable in Node. The Blockly block
 * definitions + toolbox for a world live in the sibling client module (e.g. turtle-blocks.ts).
 *
 * Anti-spoof: the wrapper swallows the pupil's own stdout while their code runs, then restores it and
 * prints only the runtime's authoritative report. A pupil cannot pass by printing the expected JSON.
 */

export type WorldId = "turtle" | "grid";

export const WORLD_IDS: readonly WorldId[] = ["turtle", "grid"] as const;

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && (WORLD_IDS as readonly string[]).includes(value);
}

type WorldDef = {
  /** Short label + one-line help for the authoring picker. */
  label: string;
  description: string;
  /** Python injected BEFORE the pupil's code: defines `kat` and its recording. */
  prelude: string;
  /** Python expression printed AFTER the pupil's code: the canonical final-state JSON (for GRADING). */
  reportExpr: string;
  /** Same, but ORDER-sensitive (exact stroke/step sequence). Used when a question opts into strict mode. */
  reportStrictExpr: string;
  /** Python expression printed for a REPLAY run: a step trace + optional error, for animation only. */
  traceExpr: string;
};

// A turtle whose forward moves draw line segments. The graded state is the SET of segments (each a
// pair of int-rounded endpoints, order-normalized), so retracing a line or starting from a different
// corner does not change the picture. Heading: 0 = east, positive = counter-clockwise (turn left).
const TURTLE_PRELUDE = `import math as _math, json as _json

class _KatTurtle:
    def __init__(self):
        self._x = 0.0
        self._y = 0.0
        self._heading = 0.0
        self._pen = True
        self._segments = set()
        self._events = []

    def _step(self, dist):
        rad = _math.radians(self._heading)
        nx = self._x + dist * _math.cos(rad)
        ny = self._y + dist * _math.sin(rad)
        self._events.append({"x1": round(self._x), "y1": round(self._y), "x2": round(nx), "y2": round(ny), "pen": bool(self._pen)})
        if self._pen:
            a = (round(self._x), round(self._y))
            b = (round(nx), round(ny))
            if a != b:
                self._segments.add((a, b) if a <= b else (b, a))
        self._x, self._y = nx, ny

    def forward(self, dist):
        self._step(dist)

    def backward(self, dist):
        self._step(-dist)

    def right(self, deg):
        self._heading = (self._heading - deg) % 360

    def left(self, deg):
        self._heading = (self._heading + deg) % 360

    def penup(self):
        self._pen = False

    def pendown(self):
        self._pen = True

    def _report(self):
        segs = sorted([a[0], a[1], b[0], b[1]] for (a, b) in self._segments)
        return _json.dumps({"segments": segs}, separators=(",", ":"))

    def _report_strict(self):
        # Ordered, DIRECTIONAL pen-down strokes: stroke order, direction, and retracing all matter now.
        strokes = [[e["x1"], e["y1"], e["x2"], e["y2"]] for e in self._events if e["pen"]]
        return _json.dumps({"strokes": strokes}, separators=(",", ":"))

    def _trace(self, error=None):
        return _json.dumps({"steps": self._events, "error": error}, separators=(",", ":"))

kat = _KatTurtle()`;

// A robot on a grid, read from stdin as JSON (so each test case is a different maze). It moves one cell
// at a time in its heading, turns, and can paint the cell it stands on. Hitting a wall or the boundary
// raises (the run fails, which is the right outcome for a crash). Graded on the FINAL state: position,
// the set of painted cells, and whether it ended on the goal, so any route that ends correct passes.
const GRID_PRELUDE = `import sys as _gsys, json as _gjson

class _KatActor:
    _DIRS = {"E": (1, 0), "S": (0, 1), "W": (-1, 0), "N": (0, -1)}
    _ORDER = ["E", "S", "W", "N"]

    def __init__(self, cfg):
        self._cols = int(cfg.get("cols", 5))
        self._rows = int(cfg.get("rows", 5))
        start = cfg.get("start", [0, 0])
        self._x = int(start[0])
        self._y = int(start[1])
        self._heading = cfg.get("heading", "E")
        if self._heading not in self._DIRS:
            self._heading = "E"
        goal = cfg.get("goal")
        self._goal = (int(goal[0]), int(goal[1])) if goal else None
        self._walls = set((int(w[0]), int(w[1])) for w in cfg.get("walls", []))
        self._painted = set()
        self._events = [self._snapshot(0)]

    def _snapshot(self, painted_now):
        return {"x": self._x, "y": self._y, "h": self._heading, "p": 1 if painted_now else 0}

    def _ahead(self):
        dx, dy = self._DIRS[self._heading]
        return (self._x + dx, self._y + dy)

    def _blocked(self, cell):
        x, y = cell
        return x < 0 or y < 0 or x >= self._cols or y >= self._rows or (x, y) in self._walls

    def can_move(self):
        return not self._blocked(self._ahead())

    def at_goal(self):
        return self._goal is not None and (self._x, self._y) == self._goal

    def move(self):
        nxt = self._ahead()
        if self._blocked(nxt):
            raise RuntimeError("hit a wall")
        self._x, self._y = nxt
        self._events.append(self._snapshot(0))

    def turn_right(self):
        self._heading = self._ORDER[(self._ORDER.index(self._heading) + 1) % 4]
        self._events.append(self._snapshot(0))

    def turn_left(self):
        self._heading = self._ORDER[(self._ORDER.index(self._heading) - 1) % 4]
        self._events.append(self._snapshot(0))

    def paint(self):
        self._painted.add((self._x, self._y))
        self._events.append(self._snapshot(1))

    def _report(self):
        painted = sorted([c[0], c[1]] for c in self._painted)
        return _gjson.dumps(
            {"pos": [self._x, self._y], "painted": painted, "goal_reached": self.at_goal()},
            separators=(",", ":"),
        )

    def _report_strict(self):
        # The exact ORDERED path (position, heading, paint-flag per event): the precise move/turn/paint
        # sequence must match the reference, not just the final position.
        path = [[e["x"], e["y"], e["h"], e["p"]] for e in self._events]
        return _gjson.dumps({"path": path}, separators=(",", ":"))

    def _trace(self, error=None):
        return _gjson.dumps({"steps": self._events, "error": error}, separators=(",", ":"))

kat = _KatActor(_gjson.loads((_gsys.stdin.read() or "").strip() or "{}"))`;

const WORLDS: Record<WorldId, WorldDef> = {
  turtle: {
    label: "Turtle (drawing)",
    description: "The blocks move a pen that draws lines. Graded on the final picture.",
    prelude: TURTLE_PRELUDE,
    reportExpr: "kat._report()",
    reportStrictExpr: "kat._report_strict()",
    traceExpr: "kat._trace(_kat_error)",
  },
  grid: {
    label: "Grid robot (maze)",
    description: "The blocks steer a robot on a grid. Graded on where it ends and what it paints.",
    prelude: GRID_PRELUDE,
    reportExpr: "kat._report()",
    reportStrictExpr: "kat._report_strict()",
    traceExpr: "kat._trace(_kat_error)",
  },
};

// ── Grid config (shared by the Python runtime, which reads it from stdin, and the TS grid renderer) ──

export type GridConfig = {
  cols: number;
  rows: number;
  start: [number, number];
  heading: "E" | "S" | "W" | "N";
  goal: [number, number] | null;
  walls: Array<[number, number]>;
};

/** A simple, obviously solvable starter maze for the authoring picker (author adds walls). */
export const DEFAULT_GRID: GridConfig = {
  cols: 6,
  rows: 6,
  start: [0, 0],
  heading: "E",
  goal: [5, 5],
  walls: [],
};

export const DEFAULT_GRID_STDIN = JSON.stringify(DEFAULT_GRID);

function toCell(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [Math.trunc(x), Math.trunc(y)] : null;
}

/**
 * Parse a grid config (a test case's stdin) into the shape both the maze renderer and the runtime agree
 * on. Returns null for anything malformed, so a caller can show a placeholder instead of throwing. Mirrors
 * the defaults the Python `_KatActor` applies, so the picture the pupil sees matches the world it runs in.
 */
export function parseGridConfig(raw: string | null | undefined): GridConfig | null {
  if (!raw || !raw.trim()) return null;
  let obj: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    obj = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const cols = Math.max(1, Math.trunc(Number(obj.cols ?? 5)) || 5);
  const rows = Math.max(1, Math.trunc(Number(obj.rows ?? 5)) || 5);
  const start = toCell(obj.start) ?? [0, 0];
  const headingRaw = typeof obj.heading === "string" ? obj.heading : "E";
  const heading = (["E", "S", "W", "N"] as const).includes(headingRaw as never) ? (headingRaw as GridConfig["heading"]) : "E";
  const goal = toCell(obj.goal);
  const walls = Array.isArray(obj.walls)
    ? obj.walls.map(toCell).filter((c): c is [number, number] => c !== null)
    : [];
  return { cols, rows, start, heading, goal, walls };
}

/** Authoring metadata for a world picker: id + label + description, no runtime source. */
export const WORLD_META: ReadonlyArray<{ id: WorldId; label: string; description: string }> =
  WORLD_IDS.map((id) => ({ id, label: WORLDS[id].label, description: WORLDS[id].description }));

/**
 * Assemble the program actually run for a world question: the world runtime, then the pupil's code with
 * its stdout swallowed, then the authoritative report on the real stdout. The pupil's code is NOT
 * indented (it runs at top level), so a multi-line string or def in their code is untouched. If their
 * code raises, the report line never runs and the case fails, which is the correct outcome for a crash.
 */
export function wrapForWorld(world: WorldId, pupilCode: string, opts?: { strict?: boolean }): string {
  const def = WORLDS[world];
  // Strict mode grades the exact stroke/step ORDER (reportStrictExpr); the default grades final state.
  // The reference is captured with the SAME flag the pupil is graded with, so the two always agree.
  const report = opts?.strict ? def.reportStrictExpr : def.reportExpr;
  return [
    def.prelude,
    "",
    "import sys as _sys, io as _io",
    "_kat_real_stdout = _sys.stdout",
    "_sys.stdout = _io.StringIO()",
    pupilCode,
    "_sys.stdout = _kat_real_stdout",
    `print(${report})`,
    "",
  ].join("\n");
}

/**
 * Assemble a REPLAY run: same runtime, but the pupil's code runs inside try/except so a crash (hitting a
 * wall) still yields the trace up to that point plus an `error`, and the program prints a STEP TRACE for
 * animation instead of the graded report. This output is never graded, so its shape can be richer and a
 * crash is captured rather than failing hard. The pupil code is indented under the try; block-generated
 * Python is uniformly indented already, so this stays valid.
 */
export function wrapForWorldTrace(world: WorldId, pupilCode: string): string {
  const def = WORLDS[world];
  const indented = pupilCode
    .split("\n")
    .map((line) => (line.length > 0 ? `    ${line}` : line))
    .join("\n");
  const body = indented.trim().length > 0 ? indented : "    pass";
  return [
    def.prelude,
    "",
    "import sys as _sys, io as _io",
    "_kat_real_stdout = _sys.stdout",
    "_sys.stdout = _io.StringIO()",
    "_kat_error = None",
    "try:",
    body,
    "except Exception as _e:",
    "    _kat_error = str(_e)",
    "_sys.stdout = _kat_real_stdout",
    `print(${def.traceExpr})`,
    "",
  ].join("\n");
}
