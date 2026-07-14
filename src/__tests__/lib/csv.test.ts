import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvWithHeader } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted fields (the reason we don't split on ',')", () => {
    expect(parseCsv('name,email\n"Okafor, Chidi",c@example.com')).toEqual([
      ["name", "email"],
      ["Okafor, Chidi", "c@example.com"],
    ]);
  });

  it("handles escaped double quotes", () => {
    expect(parseCsv('name\n"She said ""hi"""')).toEqual([["name"], ['She said "hi"']]);
  });

  it("handles CRLF line endings (Excel/Windows)", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a UTF-8 BOM from the first header", () => {
    expect(parseCsv("﻿name,guardian\nAda,x@example.com")[0]).toEqual(["name", "guardian"]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a\n\n\nb\n")).toEqual([["a"], ["b"]]);
  });

  it("preserves leading/trailing spaces inside quotes but trims bare fields", () => {
    expect(parseCsv('a, b ,"  c  "')).toEqual([["a", "b", "  c  "]]);
  });

  it("handles a newline inside a quoted field", () => {
    expect(parseCsv('name\n"Line1\nLine2"')).toEqual([["name"], ["Line1\nLine2"]]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseCsvWithHeader", () => {
  it("maps rows onto lowercased headers", () => {
    const { headers, rows } = parseCsvWithHeader("Name,Guardian Email\nAda Obi,mum@example.com");
    expect(headers).toEqual(["name", "guardian email"]);
    expect(rows).toEqual([{ name: "Ada Obi", "guardian email": "mum@example.com" }]);
  });

  it("fills missing trailing cells with empty strings", () => {
    const { rows } = parseCsvWithHeader("name,guardian\nAda Obi");
    expect(rows).toEqual([{ name: "Ada Obi", guardian: "" }]);
  });

  it("returns empty for empty input", () => {
    expect(parseCsvWithHeader("")).toEqual({ headers: [], rows: [] });
  });
});
