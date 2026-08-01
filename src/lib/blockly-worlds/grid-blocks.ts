"use client";

/**
 * Blockly blocks + toolbox for the GRID (maze) world. The blocks generate Python that drives the `kat`
 * robot defined by the grid prelude (see ./index.ts): move / turn left / turn right / paint, plus two
 * boolean sensors (can move? / at goal?) so a pupil can loop and branch to navigate. Grading is on the
 * robot's final position and painted cells, not a printout.
 *
 * Registration is idempotent and lazy, and resolves the SAME cached `blockly` module BlocklyWorkspace
 * uses, so the block + generator definitions land in the registry inject / workspaceToCode read from.
 */

const GRID_BLOCK_DEFS = [
  { type: "kat_move", message0: "move forward", previousStatement: null, nextStatement: null, colour: 20, tooltip: "Move one cell in the direction the robot faces." },
  { type: "kat_turn_left", message0: "turn left", previousStatement: null, nextStatement: null, colour: 20, tooltip: "Turn the robot 90 degrees left." },
  { type: "kat_turn_right", message0: "turn right", previousStatement: null, nextStatement: null, colour: 20, tooltip: "Turn the robot 90 degrees right." },
  { type: "kat_paint", message0: "paint this cell", previousStatement: null, nextStatement: null, colour: 20, tooltip: "Colour the cell the robot is standing on." },
  { type: "kat_can_move", message0: "can move?", output: "Boolean", colour: 45, tooltip: "True when the cell ahead is open (no wall, on the grid)." },
  { type: "kat_at_goal", message0: "at goal?", output: "Boolean", colour: 45, tooltip: "True when the robot is standing on the goal." },
];

/** The maze toolbox: the robot commands and sensors, plus enough logic/loops to solve a maze. */
export const GRID_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Robot",
      colour: "20",
      contents: [
        { kind: "block", type: "kat_move" },
        { kind: "block", type: "kat_turn_left" },
        { kind: "block", type: "kat_turn_right" },
        { kind: "block", type: "kat_paint" },
      ],
    },
    {
      kind: "category",
      name: "Sensing",
      colour: "45",
      contents: [
        { kind: "block", type: "kat_can_move" },
        { kind: "block", type: "kat_at_goal" },
      ],
    },
    {
      kind: "category",
      name: "Logic",
      categorystyle: "logic_category",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_negate" },
      ],
    },
    {
      kind: "category",
      name: "Loops",
      categorystyle: "loop_category",
      contents: [
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 5 } } } } },
        { kind: "block", type: "controls_whileUntil" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      categorystyle: "math_category",
      contents: [{ kind: "block", type: "math_number", fields: { NUM: 0 } }],
    },
    { kind: "category", name: "Variables", categorystyle: "variable_category", custom: "VARIABLE" },
  ],
};

let registered = false;

/** Define the grid robot blocks and their Python generators once. Safe to call repeatedly. */
export async function registerGridWorld(): Promise<void> {
  if (registered) return;
  const Blockly = await import("blockly");
  const { pythonGenerator, Order } = await import("blockly/python");
  if (!(Blockly.Blocks as Record<string, unknown>).kat_move) {
    Blockly.defineBlocksWithJsonArray(GRID_BLOCK_DEFS as never);
  }

  const gen = pythonGenerator as unknown as {
    forBlock: Record<string, (block: unknown) => string | [string, number]>;
  };

  gen.forBlock.kat_move = () => "kat.move()\n";
  gen.forBlock.kat_turn_left = () => "kat.turn_left()\n";
  gen.forBlock.kat_turn_right = () => "kat.turn_right()\n";
  gen.forBlock.kat_paint = () => "kat.paint()\n";
  gen.forBlock.kat_can_move = () => ["kat.can_move()", Order.FUNCTION_CALL];
  gen.forBlock.kat_at_goal = () => ["kat.at_goal()", Order.FUNCTION_CALL];

  registered = true;
}
