"use client";

/**
 * Blockly blocks + toolbox for the TURTLE world. The blocks generate Python that calls the `kat` turtle
 * defined by the turtle prelude (see ./index.ts): move forward/back, turn right/left, pen up/down. Loops
 * and Math come from stock Blockly so a pupil can "repeat 4 times". Grading is on the drawing, not the
 * printout, so there is deliberately no print/text category here.
 *
 * Registration is idempotent and lazy: BlocklyWorkspace calls registerTurtleWorld() before it injects,
 * and both this module and the workspace resolve the SAME cached `blockly` module, so the block and
 * generator definitions land in the registry that Blockly.inject / workspaceToCode use.
 */

const TURTLE_BLOCK_DEFS = [
  {
    type: "kat_forward",
    message0: "move forward %1 steps",
    args0: [{ type: "input_value", name: "STEPS", check: "Number" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: 20,
    tooltip: "Move the pen forward, drawing a line when the pen is down.",
  },
  {
    type: "kat_back",
    message0: "move back %1 steps",
    args0: [{ type: "input_value", name: "STEPS", check: "Number" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: 20,
    tooltip: "Move the pen backward.",
  },
  {
    type: "kat_right",
    message0: "turn right %1 degrees",
    args0: [{ type: "input_value", name: "DEG", check: "Number" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: 20,
    tooltip: "Turn clockwise.",
  },
  {
    type: "kat_left",
    message0: "turn left %1 degrees",
    args0: [{ type: "input_value", name: "DEG", check: "Number" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: 20,
    tooltip: "Turn counter-clockwise.",
  },
  {
    type: "kat_penup",
    message0: "pen up",
    previousStatement: null,
    nextStatement: null,
    colour: 20,
    tooltip: "Stop drawing while moving.",
  },
  {
    type: "kat_pendown",
    message0: "pen down",
    previousStatement: null,
    nextStatement: null,
    colour: 20,
    tooltip: "Start drawing while moving.",
  },
];

/** The turtle toolbox: the turtle commands plus enough loops/math/variables to build real drawings. */
export const TURTLE_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Turtle",
      colour: "20",
      contents: [
        { kind: "block", type: "kat_forward", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 50 } } } } },
        { kind: "block", type: "kat_back", inputs: { STEPS: { shadow: { type: "math_number", fields: { NUM: 50 } } } } },
        { kind: "block", type: "kat_right", inputs: { DEG: { shadow: { type: "math_number", fields: { NUM: 90 } } } } },
        { kind: "block", type: "kat_left", inputs: { DEG: { shadow: { type: "math_number", fields: { NUM: 90 } } } } },
        { kind: "block", type: "kat_penup" },
        { kind: "block", type: "kat_pendown" },
      ],
    },
    {
      kind: "category",
      name: "Loops",
      categorystyle: "loop_category",
      contents: [
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 4 } } } } },
        { kind: "block", type: "controls_for", inputs: { FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } }, TO: { shadow: { type: "math_number", fields: { NUM: 4 } } }, BY: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
      ],
    },
    {
      kind: "category",
      name: "Math",
      categorystyle: "math_category",
      contents: [
        { kind: "block", type: "math_number", fields: { NUM: 0 } },
        { kind: "block", type: "math_arithmetic" },
      ],
    },
    { kind: "category", name: "Variables", categorystyle: "variable_category", custom: "VARIABLE" },
  ],
};

let registered = false;

/** Define the turtle blocks and their Python generators once. Safe to call repeatedly. */
export async function registerTurtleWorld(): Promise<void> {
  if (registered) return;
  const Blockly = await import("blockly");
  const { pythonGenerator, Order } = await import("blockly/python");
  // Another mount may have registered already (or a prior call in this one); the flag + registry both guard.
  if (!(Blockly.Blocks as Record<string, unknown>).kat_forward) {
    Blockly.defineBlocksWithJsonArray(TURTLE_BLOCK_DEFS as never);
  }

  const gen = pythonGenerator as unknown as {
    forBlock: Record<string, (block: unknown) => string>;
    valueToCode: (block: unknown, name: string, order: number) => string;
  };
  const num = (block: unknown, name: string) => gen.valueToCode(block, name, Order.NONE) || "0";

  gen.forBlock.kat_forward = (b) => `kat.forward(${num(b, "STEPS")})\n`;
  gen.forBlock.kat_back = (b) => `kat.backward(${num(b, "STEPS")})\n`;
  gen.forBlock.kat_right = (b) => `kat.right(${num(b, "DEG")})\n`;
  gen.forBlock.kat_left = (b) => `kat.left(${num(b, "DEG")})\n`;
  gen.forBlock.kat_penup = () => "kat.penup()\n";
  gen.forBlock.kat_pendown = () => "kat.pendown()\n";

  registered = true;
}
