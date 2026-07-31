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

export type WorldId = "turtle";

export const WORLD_IDS: readonly WorldId[] = ["turtle"] as const;

export function isWorldId(value: unknown): value is WorldId {
  return typeof value === "string" && (WORLD_IDS as readonly string[]).includes(value);
}

type WorldDef = {
  /** Short label + one-line help for the authoring picker. */
  label: string;
  description: string;
  /** Python injected BEFORE the pupil's code: defines `kat` and its recording. */
  prelude: string;
  /** Python expression printed AFTER the pupil's code: the canonical final-state JSON. */
  reportExpr: string;
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

    def _step(self, dist):
        rad = _math.radians(self._heading)
        nx = self._x + dist * _math.cos(rad)
        ny = self._y + dist * _math.sin(rad)
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

kat = _KatTurtle()`;

const WORLDS: Record<WorldId, WorldDef> = {
  turtle: {
    label: "Turtle (drawing)",
    description: "The blocks move a pen that draws lines. Graded on the final picture.",
    prelude: TURTLE_PRELUDE,
    reportExpr: "kat._report()",
  },
};

/** Authoring metadata for a world picker: id + label + description, no runtime source. */
export const WORLD_META: ReadonlyArray<{ id: WorldId; label: string; description: string }> =
  WORLD_IDS.map((id) => ({ id, label: WORLDS[id].label, description: WORLDS[id].description }));

/**
 * Assemble the program actually run for a world question: the world runtime, then the pupil's code with
 * its stdout swallowed, then the authoritative report on the real stdout. The pupil's code is NOT
 * indented (it runs at top level), so a multi-line string or def in their code is untouched. If their
 * code raises, the report line never runs and the case fails, which is the correct outcome for a crash.
 */
export function wrapForWorld(world: WorldId, pupilCode: string): string {
  const def = WORLDS[world];
  return [
    def.prelude,
    "",
    "import sys as _sys, io as _io",
    "_kat_real_stdout = _sys.stdout",
    "_sys.stdout = _io.StringIO()",
    pupilCode,
    "_sys.stdout = _kat_real_stdout",
    `print(${def.reportExpr})`,
    "",
  ].join("\n");
}
