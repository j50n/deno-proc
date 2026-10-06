/**
 * Plain TypeScript readers and writers for CSV and TSV, written the slow,
 * obvious way, as the reference the WebAssembly code is tested against. They
 * share no code with it.
 *
 * The rules, where RFC 4180 leaves room: a quote opens a quoted field only at
 * the start of a field and is content anywhere else, including after a
 * closing quote; CR outside quotes is dropped; a blank line is no row; a
 * quote still open at the end of the input ends there. TSV has no quoting,
 * so every CR is dropped.
 */

/** Rows of CSV text. */
export function readCsvReference(text: string, separator = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoteJustClosed = false;
  let fieldStarted = false; // the current field has begun: content or a quote
  let rowStarted = false; // the current row has begun

  for (const char of text) {
    if (inQuotes) {
      if (char === '"') {
        inQuotes = false;
        quoteJustClosed = true;
      } else {
        field += char;
      }
      continue;
    }
    if (quoteJustClosed) {
      quoteJustClosed = false;
      if (char === '"') { // "" inside quotes is one quote
        field += '"';
        inQuotes = true;
        continue;
      }
    }
    if (char === separator) {
      row.push(field);
      field = "";
      fieldStarted = false;
      rowStarted = true;
    } else if (char === "\n") {
      if (rowStarted || fieldStarted) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
      fieldStarted = false;
      rowStarted = false;
    } else if (char === "\r") {
      // dropped
    } else if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      rowStarted = true;
    } else {
      field += char;
      fieldStarted = true;
      rowStarted = true;
    }
  }
  if (rowStarted || fieldStarted) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Rows of TSV text. */
export function readTsvReference(text: string): string[][] {
  return text.replaceAll("\r", "").split("\n")
    .filter((line) => line !== "")
    .map((line) => line.split("\t"));
}

/**
 * CSV text of rows, quoting a field only when it must be quoted, or when it
 * is a row's only field and empty, which would otherwise be a blank line.
 */
export function writeCsvReference(
  rows: string[][],
  separator = ",",
  lineEnd = "\n",
): string {
  return rows.map((row) =>
    row.length === 1 && row[0] === ""
      ? '""' + lineEnd
      : row.map((field) =>
        field.includes(separator) || /["\r\n]/.test(field)
          ? `"${field.replaceAll('"', '""')}"`
          : field
      ).join(separator) + lineEnd
  ).join("");
}

/** TSV text of rows that TSV can hold. */
export function writeTsvReference(rows: string[][]): string {
  return rows.map((row) => row.join("\t") + "\n").join("");
}

const long = "🎉 long field, past one 64-byte block: " +
  "東京 délta ".repeat(12);

/**
 * Small inputs for what realistic data lacks. Each one is read at many chunk
 * sizes, so every byte lands at every chunk and 64-byte block position.
 */
export const EDGE_CSV: string[] = [
  // CRLF, empty fields, blank lines (LF and CRLF), final row without newline
  "a,b,c\r\n,,\r\n\r\n\n,\nx,y,z",
  // fields that are only quotes, empty quoted fields, a lone empty quoted row
  '"",""""," "\n"""",""""""\n""\n"""""",x\n',
  // malformed quotes: quote mid-field, text after a closing quote, space after it
  '"a""b",c""d,e"f\n"abc"def,"x" ,"y"\r\n"q"",r\n',
  // quoted separators, newlines, CRs and tabs; tab outside quotes; UTF-8
  '"multi\r\nline\twith tab",🎉,東京\nplain\ttab,"a,b","\r"\n',
  // long fields, quoted and not, crossing block edges
  `${long},"${long.replaceAll(" ", '""')}",${long}\n"${long}"\n`,
  // record-format separators as content
  "a\x1Fb,c\x1Ed\n\x1E,\x1F\n",
  // unterminated quote at the end
  'a,"open, never\nclosed',
  // a quote closed exactly at the end, no newline
  'a,"b"',
  // trailing separator at the end
  "a,",
  // a lone CR, CRs alone on lines
  "\r",
  "x\r\r\n\r\ny\n",
  "",
  "\n\n\r\n",
];

/** Small TSV inputs, for the same purpose. */
export const EDGE_TSV: string[] = [
  'a\t"b"\tc,d\r\n\n\te\r\nlast',
  "x\r\ty\r\r\n\r\n\t\t\n",
  `${long}\t"${long}"\t${long},\n`,
  'q"q\t""\t,\n🎉\n',
  "a\x1Fb\tc\x1Ed\n",
  "ends in CR\r",
  "ends in tab\t",
  "\r\r\n",
  "",
  "\n\n",
];

/** Split bytes into chunks of `size`. */
export function chunked(bytes: Uint8Array, size: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) {
    chunks.push(bytes.subarray(i, i + size));
  }
  return chunks;
}

/** Chunk sizes that land boundaries on, around and between 64-byte blocks. */
export const CHUNK_SIZES = [1, 7, 63, 64, 65, 1000];
