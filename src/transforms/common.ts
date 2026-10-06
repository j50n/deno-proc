// Constants and helpers shared by the transforms.

import type { TransformerFunction } from "../transformers.ts";
import type { RowBatch } from "../wasm/flatdata.ts";
import { decodeBatch } from "./decode.ts";
import { lastBytes, textBeforeInvalid } from "../helpers.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";

/**
 * About how much input, 128 KiB, makes one batch. The CSV and TSV parsers
 * read input in chunks of this size and yield the rows each chunk completes;
 * the record and JSON-lines parsers end a batch once it holds this much text,
 * so a batch can run over by one row.
 */
export const BATCH_SIZE_BYTES = 128 * 1024;

/** Ends each record in the record format: `"\x1E"` (ASCII RS). */
export const RECORD_SEPARATOR = "\x1E";

/** Separates the fields of a record in the record format: `"\x1F"` (ASCII US). */
export const FIELD_SEPARATOR = "\x1F";

/**
 * Decode a byte stream and split it on `separator`, yielding the complete
 * pieces from each chunk. The text after the last separator comes last, if
 * there is any.
 *
 * Each stream gets its own decoder, because a decoder carries a character split
 * across two chunks from one to the next.
 *
 * Invalid UTF-8 is a `TypeError` with the message `invalid` makes from the
 * number of the piece holding it, counting from 1; the pieces before it are
 * yielded first.
 */
export async function* splitText(
  bytes: AsyncIterable<Uint8Array>,
  separator: string,
  invalid: (piece: number) => string,
): AsyncIterable<string[]> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let tail = "";
  let count = 0;
  let recent: Uint8Array = new Uint8Array(0);

  for await (const chunk of bytes) {
    let text: string;
    let failed = false;
    try {
      text = decoder.decode(chunk, { stream: true });
    } catch {
      const atStart = count === 0 && !tail;
      text = textBeforeInvalid(recent, chunk, separator.charCodeAt(0), atStart);
      failed = true;
    }
    recent = lastBytes(recent, chunk);
    // Re-splitting a long unfinished piece on every chunk would be quadratic.
    if (text.includes(separator)) {
      const pieces = (tail + text).split(separator);
      tail = pieces.pop()!;
      count += pieces.length;
      yield pieces;
    } else {
      tail += text;
    }
    if (failed) throw new TypeError(invalid(count + 1));
  }

  try {
    tail += decoder.decode();
  } catch {
    throw new TypeError(invalid(count + 1));
  }
  if (tail !== "") yield [tail];
}

/**
 * The rows of a batch from the reader as string arrays: the whole batch
 * decoded with one call, then sliced. Decoding field by field is several
 * times slower.
 */
export function batchRows(batch: RowBatch): Row[] {
  const text = decodeBatch(batch);
  const ends = batch.textEnds;
  const rows: Row[] = [];
  let row: Row = [];
  let start = 0;
  for (let j = 0; j < ends.length; j++) {
    const end = ends[j];
    row.push(text.slice(start, end));
    if (text.charCodeAt(end) === 0x1E) {
      rows.push(row);
      row = [];
    }
    start = end + 1;
  }
  return rows;
}

/**
 * Normalize one item of a row stream (a row, or an array of rows) to an array
 * of rows.
 */
export function asRows(
  item: Row | Row[] | LazyRow | LazyRow[],
): (Row | LazyRow)[] {
  if (item instanceof LazyRow) return [item];
  if (item.length === 0) return [];
  const first = item[0];
  return first instanceof LazyRow || Array.isArray(first)
    ? item as (Row | LazyRow)[]
    : [item as Row];
}

/**
 * A transformer that writes each item of a row stream as text, one line per
 * row from `line`, and encodes once per item: building one string and
 * encoding it is several times faster than encoding row by row. Each item is
 * normalized on its own, so a stream can mix rows and batches.
 *
 * `line` gets the row's fields and its number in the stream, counting from 1.
 * A row with no fields never reaches it: no format can write one that reads
 * back, so it throws, naming the row, with `format` as the format's name. A
 * field holding a lone surrogate throws too, since UTF-8 can't hold one and
 * `TextEncoder` would write U+FFFD in its place.
 */
export function rowWriter(
  format: string,
  line: (fields: string[], rowNumber: number) => string,
): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array<ArrayBuffer>
> {
  return async function* (items) {
    const encoder = new TextEncoder();
    let rowNumber = 0;
    for await (const item of items) {
      let text = "";
      const rows = asRows(item);
      const first = rowNumber + 1;
      for (const row of rows) {
        const fields = row instanceof LazyRow ? row.toStringArray() : row;
        rowNumber++;
        if (fields.length === 0) {
          throw invalidRow("no fields", format, rowNumber);
        }
        text += line(fields, rowNumber);
      }
      // One check of the whole text; the rows are looked at only to say where.
      if (!text.isWellFormed()) throw loneSurrogate(rows, first, format);
      yield encoder.encode(text);
    }
  };
}

/** The error for the first field of `rows` that holds a lone surrogate. */
function loneSurrogate(
  rows: (Row | LazyRow)[],
  firstRowNumber: number,
  format: string,
): Error {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const fields = row instanceof LazyRow ? row.toStringArray() : row;
    for (let f = 0; f < fields.length; f++) {
      // With the u flag, \p{Surrogate} matches only an unpaired one.
      const match = /\p{Surrogate}/u.exec(fields[f]);
      if (match) {
        return invalidCharacter(
          match[0].charCodeAt(0),
          format,
          firstRowNumber + r,
          f,
        );
      }
    }
  }
  return new Error(`Invalid text in ${format} data`);
}

/**
 * Throw if a field holds a character the format can't represent. `forbidden`
 * matches any such character.
 */
export function checkFields(
  fields: string[],
  forbidden: RegExp,
  format: string,
  rowNumber: number,
): void {
  for (let f = 0; f < fields.length; f++) {
    const match = forbidden.exec(fields[f]);
    if (match) {
      throw invalidCharacter(match[0].charCodeAt(0), format, rowNumber, f);
    }
  }
}

const CHARACTER_NAMES: Record<number, string> = {
  0x09: "tab",
  0x0A: "LF",
  0x0D: "CR",
  0x1E: "record separator",
  0x1F: "field separator",
  0xFEFF: "byte order mark",
};

/**
 * Throw if the stream's first field starts with U+FEFF, for a format with no
 * quoting: written first, it is a UTF-8 byte order mark, and readers drop
 * one at the start.
 */
export function checkNoLeadingBom(
  fields: string[],
  format: string,
  rowNumber: number,
): void {
  if (rowNumber === 1 && fields[0].startsWith("\uFEFF")) {
    throw invalidCharacter(0xFEFF, format, rowNumber, 0);
  }
}

/** The error for a character a format can't hold, at a 0-based field index. */
export function invalidCharacter(
  code: number,
  format: string,
  rowNumber: number,
  fieldIndex: number,
): Error {
  const name = CHARACTER_NAMES[code] ??
    (code >= 0xD800 && code <= 0xDFFF
      ? "lone surrogate"
      : `0x${code.toString(16)}`);
  return new Error(
    `Invalid character (${name}) in ${format} data at row ${rowNumber}, field ${
      fieldIndex + 1
    }`,
  );
}

/**
 * The error for a row a format can't hold, such as one with no fields, which
 * would be written as a line that reads back as no row. `what` says what the
 * row holds.
 */
export function invalidRow(
  what: string,
  format: string,
  rowNumber: number,
): Error {
  return new Error(
    `Invalid row (${what}) in ${format} data at row ${rowNumber}`,
  );
}
