/**
 * Turns a raw Python traceback into a short, beginner-friendly hint, or null when there's no good
 * mapping (the UI then just shows the raw error). This only ADDS a plain-English nudge above the real
 * traceback, it never replaces it. It matches on the LAST non-empty line of the traceback, where the
 * actual `SomeError: message` lives. Pure and client-safe so it works for both Pyodide and Judge0
 * output and can be unit-tested.
 */
export function pythonErrorHint(stderr: string): string | null {
  if (!stderr) return null;
  const last = [...stderr.trim().split(/\r?\n/)].reverse().find((l) => /\S/.test(l))?.trim() ?? "";

  let m: RegExpMatchArray | null;

  if ((m = last.match(/^NameError: name '([^']+)' is not defined/))) {
    return `Python doesn't know what \`${m[1]}\` is. Check the spelling, define it before you use it, or put quotes around it if it's meant to be text.`;
  }
  if (/^IndentationError/.test(last) || /expected an indented block/.test(last)) {
    return "Python cares about indentation. Make sure the lines inside a loop, if, or function are all indented the same amount (4 spaces is usual).";
  }
  if (/^SyntaxError/.test(last) || /^TabError/.test(last)) {
    if (/EOF|was never closed|unexpected EOF/.test(last)) {
      return "It looks like a bracket, quote, or block was left open. Check for a missing `)`, `]`, `}`, or quote.";
    }
    return "There's a typo in the code's structure. Check the reported line for a missing `:`, bracket, or quote, and `=` (assign) vs `==` (compare).";
  }
  if ((m = last.match(/^ModuleNotFoundError: No module named '([^']+)'/))) {
    return `The module \`${m[1]}\` isn't available. Check the spelling, or add it from the packages panel if it's a real package.`;
  }
  if (/^TypeError: can only concatenate str/.test(last) || /^TypeError: unsupported operand type/.test(last)) {
    return "You're mixing types that don't go together (like adding text and a number). Convert one first, for example `str(n)` or `int(s)`.";
  }
  if (/^TypeError/.test(last)) {
    return "A value was used in a way its type doesn't allow. Check the types of the values you're combining, and the arguments you passed to a function.";
  }
  if (/^IndexError: (list|string|tuple)?\s*index out of range/.test(last)) {
    return "You tried to read a position that doesn't exist. Remember the first item is at index 0, and the last is at length minus 1.";
  }
  if ((m = last.match(/^KeyError: (.+)$/))) {
    return `The key ${m[1]} isn't in the dictionary. Check the key, or add it before you read it.`;
  }
  if (/^ZeroDivisionError/.test(last)) {
    return "You divided by zero. Make sure the number you're dividing by can't be 0.";
  }
  if (/^ValueError: invalid literal for int\(\)/.test(last)) {
    return "You tried to turn text that isn't a whole number into a number. Check what you're passing to `int()`.";
  }
  if ((m = last.match(/^AttributeError: .*?has no attribute '([^']+)'/))) {
    return `That value doesn't have \`${m[1]}\`. Check the spelling, or that the value is the type of thing you expect.`;
  }
  if (/^RecursionError/.test(last)) {
    return "A function called itself too many times with no way to stop. Make sure your recursion has a base case that returns without calling again.";
  }
  if (/^EOFError/.test(last)) {
    return "The program asked for input but there was none left. Type the values into the input box (one per line) before running.";
  }
  return null;
}
