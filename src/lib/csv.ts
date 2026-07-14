/**
 * A small RFC 4180 CSV parser.
 *
 * Hand-rolled rather than adding a dependency for a two-column roster file, but
 * NOT a naive `split(",")`: real rosters contain quoted fields with embedded
 * commas ("Okafor, Chidi"), escaped quotes (""), and CRLF line endings. Splitting
 * on commas would silently corrupt those names, which for a children's roster is
 * a data-integrity bug, not a cosmetic one.
 */

/** Parse CSV text into rows of raw string cells. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;

  // Strip a UTF-8 BOM. Excel adds one, and it would corrupt the first header.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endField = () => {
    row.push(fieldWasQuoted ? field : field.trim());
    field = "";
    fieldWasQuoted = false;
  };

  const endRow = () => {
    endField();
    // Drop blank lines (a single empty, unquoted field).
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\r") {
      // handled by the \n branch; ignore (CRLF)
    } else if (char === "\n") {
      endRow();
    } else {
      field += char;
    }
  }

  // Trailing field/row with no newline at EOF.
  if (field !== "" || row.length > 0 || fieldWasQuoted) endRow();

  return rows;
}

/**
 * Parse a roster CSV into objects keyed by header name (lowercased, trimmed).
 * Returns the header row plus the data rows, so callers can report a bad header
 * before touching any data.
 */
export function parseCsvWithHeader(text: string): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  const all = parseCsv(text);
  if (all.length === 0) return { headers: [], rows: [] };

  const headers = all[0].map((h) => h.trim().toLowerCase());
  const rows = all.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (cells[i] ?? "").trim();
    });
    return record;
  });

  return { headers, rows };
}
