/**
 * Plain TypeScript readers and writers for CSV and TSV, written the slow,
 * obvious way, as the reference the WebAssembly code is tested against. They
 * share no code with it.
 *
 * The rules, where RFC 4180 leaves room: a quote opens a quoted field only at
 * the start of a field and is content anywhere else, including after a
 * closing quote; lines end in LF or CRLF, and outside quotes a CR anywhere
 * else is an error; a blank line is no row; a quote still open at the end of
 * the input is an error, at the row and field where it opened. TSV has no
 * quoting, so the CR rule holds everywhere.
 */

/** The error for a CR not before LF, at a row and field counted from 1. */
export function strayCrMessage(format: string, row: number, field: number) {
  return `Invalid character (CR) in ${format} data at row ${row}, field ${field}`;
}

/** The error for a quote still open at the end, where it opened. */
export function unclosedQuoteMessage(row: number, field: number) {
  return `Unclosed quote in CSV data at row ${row}, field ${field}`;
}

/**
 * A seeded generator of integers in `[0, n)`: mulberry32, whose state stays
 * a 32-bit integer, so it neither loses precision nor repeats for 2^32 draws.
 */
export function seededRandom(seed: number): (n: number) => number {
  let state = seed >>> 0;
  return (n) => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 2 ** 32 * n) | 0;
  };
}

/** Rows of CSV text. */
export function readCsvReference(text: string, separator = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoteJustClosed = false;
  let fieldStarted = false; // the current field has begun: content or a quote
  let rowStarted = false; // the current row has begun

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
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
      if (text[i + 1] !== "\n") {
        throw new Error(
          strayCrMessage("CSV", rows.length + 1, row.length + 1),
        );
      }
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
  if (inQuotes) {
    throw new Error(unclosedQuoteMessage(rows.length + 1, row.length + 1));
  }
  if (rowStarted || fieldStarted) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Rows of TSV text. */
export function readTsvReference(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) {
    const isLast = i === lines.length - 1;
    const body = !isLast && line.endsWith("\r") ? line.slice(0, -1) : line;
    const cr = body.indexOf("\r");
    if (cr >= 0) {
      const field = body.slice(0, cr).split("\t").length;
      throw new Error(strayCrMessage("TSV", rows.length + 1, field));
    }
    if (body !== "") rows.push(body.split("\t"));
  }
  return rows;
}

/** The rows a reader gives, or the message of the error it throws. */
export function rowsOrError(read: () => string[][]): string[][] | string {
  try {
    return read();
  } catch (error) {
    return (error as Error).message;
  }
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

/**
 * `before`, then padding, then `mark` and `after`, appended to ASCII `text`,
 * with the padding chosen so that `mark` starts at `offset` in a chunk of
 * `size`.
 */
function padded(
  text: string,
  size: number,
  offset: number,
  before: string,
  mark: string,
  after: string,
): string {
  const start = text.length + before.length;
  const pad = ((offset - start) % size + size) % size;
  return text + before + "y".repeat(pad) + mark + after;
}

/**
 * Lines of `before`, padding, `mark` and `after`, two for every chunk size:
 * one with a chunk boundary right after the first byte of `mark`, one with a
 * boundary right before it.
 */
function acrossChunkEdges(before: string, mark: string, after: string) {
  let text = "";
  for (const size of CHUNK_SIZES) {
    text = padded(text, size, size - 1, before, mark, after);
    text = padded(text, size, 0, before, mark, after);
  }
  return text;
}

/**
 * For every chunk size, `before`, padding and a CR that ends a chunk, then
 * `after`: one input per size, since each holds a CR that is an error.
 */
function crEndingAChunk(before: string, after: string): string[] {
  return CHUNK_SIZES.map((size) =>
    padded("", size, size - 1, before, "\r", after)
  );
}

const long = "🎉 long field, past one 64-byte block: " +
  "東京 délta ".repeat(12);

/**
 * Small inputs for what realistic data lacks. Each one is read at many chunk
 * sizes, so every byte lands at every chunk and 64-byte block position. Some
 * are errors, which every reader must report as the reference does.
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
  // errors: a quote still open at the end, with and without a line break in it
  'a,"open, never\nclosed',
  'x\ny,"z',
  '"',
  'a,b\n"""',
  ...CHUNK_SIZES.map((size) => padded("", size, size - 1, "a\n", '"', "b")),
  // a quote closed exactly at the end, no newline
  'a,"b"',
  // trailing separator at the end
  "a,",
  "",
  "\n\n\r\n",
  // CRLF split between chunks, at every chunk size
  acrossChunkEdges("a,", "\r\n", ""),
  // a quoted CR split from what is before and after it, at every chunk size
  acrossChunkEdges('q,"', "\r", 'z"\n'),
  acrossChunkEdges('"', "\r", '",x\r\n'),
  // errors: a CR not before LF, outside quotes
  "a,b\nc,d\re\n", // mid-field: row 2, field 2
  "a,b\rc,d\r", // CR-only line ends: row 1, field 2
  "a,b\nc\r", // CR at the end: row 2, field 1
  '"a"\rb\n', // after a closing quote
  "a,\r,b\n", // before a separator
  "\r",
  "x\r\r\n\r\ny\n",
  ...crEndingAChunk("a,b\nc,", "d\n"), // resolved by the next chunk
  ...crEndingAChunk("a,b\nc,", ""), // and by the end of the stream
];

/** Small TSV inputs, for the same purpose. */
export const EDGE_TSV: string[] = [
  'a\t"b"\tc,d\r\n\n\te\r\nlast',
  `${long}\t"${long}"\t${long},\n`,
  'q"q\t""\t,\n🎉\n',
  "a\x1Fb\tc\x1Ed\n",
  "ends in tab\t",
  "",
  "\n\n",
  // CRLF split between chunks, at every chunk size
  acrossChunkEdges("a\t", "\r\n", ""),
  // errors: a CR not before LF
  "a\tb\nc\td\re\n", // mid-field: row 2, field 2
  "a\tb\rc\td\r", // CR-only line ends: row 1, field 2
  "a\tb\nc\r", // CR at the end: row 2, field 1
  'a\t"b\r"\n', // a quote doesn't protect it
  "x\r\ty\r\r\n\r\n\t\t\n",
  "ends in CR\r",
  "\r\r\n",
  ...crEndingAChunk("a\tb\nc\t", "d\n"), // resolved by the next chunk
  ...crEndingAChunk("a\tb\nc\t", ""), // and by the end of the stream
];
