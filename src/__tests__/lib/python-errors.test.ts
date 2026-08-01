import { describe, it, expect } from "vitest";
import { pythonErrorHint } from "@/lib/python-errors";

// A realistic traceback ending in the given error line.
const tb = (errLine: string) =>
  `Traceback (most recent call last):\n  File "<exec>", line 1, in <module>\n${errLine}`;

describe("pythonErrorHint", () => {
  it("returns null for empty input or clean output", () => {
    expect(pythonErrorHint("")).toBeNull();
    expect(pythonErrorHint("hello world\n")).toBeNull();
  });

  it("names the undefined variable for NameError", () => {
    const h = pythonErrorHint(tb("NameError: name 'total' is not defined"));
    expect(h).toContain("`total`");
    expect(h).toMatch(/spell|define|quotes/i);
  });

  it("explains indentation errors", () => {
    expect(pythonErrorHint(tb("IndentationError: expected an indented block"))).toMatch(/indent/i);
  });

  it("distinguishes an unclosed bracket from a general syntax error", () => {
    expect(pythonErrorHint(tb("SyntaxError: '(' was never closed"))).toMatch(/bracket|quote|open/i);
    expect(pythonErrorHint(tb("SyntaxError: invalid syntax"))).toMatch(/typo|missing/i);
  });

  it("names the missing module", () => {
    const h = pythonErrorHint(tb("ModuleNotFoundError: No module named 'requests'"));
    expect(h).toContain("`requests`");
  });

  it("gives a type-mix hint for str+int concatenation", () => {
    const h = pythonErrorHint(tb('TypeError: can only concatenate str (not "int") to str'));
    expect(h).toMatch(/str\(|int\(|convert/i);
  });

  it("handles common runtime errors", () => {
    expect(pythonErrorHint(tb("IndexError: list index out of range"))).toMatch(/index 0|position/i);
    expect(pythonErrorHint(tb("ZeroDivisionError: division by zero"))).toMatch(/zero/i);
    expect(pythonErrorHint(tb("EOFError: EOF when reading a line"))).toMatch(/input box/i);
    expect(pythonErrorHint(tb("KeyError: 'age'"))).toContain("'age'");
  });

  it("returns null for an error type we do not map", () => {
    expect(pythonErrorHint(tb("KeyboardInterrupt"))).toBeNull();
  });

  it("reads the LAST error line (ignores earlier traceback frames)", () => {
    const multi = "Traceback...\nNameError: name 'x' is not defined\n  File ...\nZeroDivisionError: division by zero";
    expect(pythonErrorHint(multi)).toMatch(/zero/i);
  });
});
