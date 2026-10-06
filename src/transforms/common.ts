// Constants and helpers shared by the transforms.

import type { TransformerFunction } from "../transformers.ts";
import type { RowBatch } from "../wasm/flatdata.ts";
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
 */
export async function* splitText(
  bytes: AsyncIterable<Uint8Array>,
  separator: string,
): AsyncIterable<string[]> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let tail = "";

  for await (const chunk of bytes) {
    const text = decoder.decode(chunk, { stream: true });
    // Re-splitting a long unfinished piece on every chunk would be quadratic.
    if (!text.includes(separator)) {
      tail += text;
      continue;
    }
    const pieces = (tail + text).split(separator);
    tail = pieces.pop()!;
    yield pieces;
  }

  tail += decoder.decode();
  if (tail !== "") yield [tail];
}

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * The rows of a batch from the reader as string arrays: the whole batch
 * decoded with one call, then sliced. Decoding field by field is several
 * times slower.
 */
export function batchRows(batch: RowBatch): Row[] {
  const text = decoder.decode(batch.bytes);
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
 */
export function rowWriter(
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
      for (const row of asRows(item)) {
        text += line(
          row instanceof LazyRow ? row.toStringArray() : row,
          ++rowNumber,
        );
      }
      yield encoder.encode(text);
    }
  };
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
};

/** The error for a character a format can't hold, at a 0-based field index. */
export function invalidCharacter(
  code: number,
  format: string,
  rowNumber: number,
  fieldIndex: number,
): Error {
  const name = CHARACTER_NAMES[code] ?? `0x${code.toString(16)}`;
  return new Error(
    `Invalid character (${name}) in ${format} data at row ${rowNumber.toLocaleString()}, field ${
      fieldIndex + 1
    }`,
  );
}
