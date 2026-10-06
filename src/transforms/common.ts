/**
 * Common constants and utilities for transform functions.
 */

import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";

/**
 * Target batch size in bytes for optimal async iteration performance.
 * Balances memory usage with async iteration overhead.
 */
export const BATCH_SIZE_BYTES = 128 * 1024; // 128KB

/**
 * ASCII control characters for Record format.
 */
export const RECORD_SEPARATOR = "\x1E"; // ASCII 30 - separates records
export const FIELD_SEPARATOR = "\x1F"; // ASCII 31 - separates fields

/**
 * Static buffer for writing 32-bit integers (reused to avoid allocations).
 */
const uint32Buffer = new Uint8Array(4);
const uint32View = new Uint32Array(uint32Buffer.buffer);

/**
 * Write a 32-bit unsigned integer to a static buffer in little-endian format.
 * Returns a slice (copy) of the static buffer containing the 4-byte integer.
 *
 * Note: The returned slice is a copy. The static buffer is reused on next call.
 *
 * @param value The integer value to write (0 to 4294967295)
 * @returns Uint8Array containing the 4-byte little-endian representation
 */
export function writeUint32LE(value: number): Uint8Array {
  uint32View[0] = value;
  return uint32Buffer.slice();
}

/**
 * Convert a single row to record format string.
 * @param row Array of field values
 * @returns Record format string: fields joined by \x1F, terminated by \x1E
 */
export function rowToRecord(row: string[]): string {
  return joinRow(row, FIELD_SEPARATOR, RECORD_SEPARATOR);
}

/**
 * Convert multiple rows to record format string.
 * @param rows Array of rows (each row is an array of field values)
 * @returns Record format string: all rows concatenated
 */
export function rowsToRecord(rows: string[][]): string {
  return joinRows(rows, FIELD_SEPARATOR, RECORD_SEPARATOR);
}

/**
 * Join a single row's fields with a separator and add a line terminator.
 * Optimized using string.concat() for better performance.
 * @param row Array of field values
 * @param fieldSep Field separator (e.g., "\t" for TSV)
 * @param lineSep Line separator (e.g., "\n")
 * @returns Joined string
 */
export function joinRow(
  row: string[],
  fieldSep: string,
  lineSep: string,
): string {
  let result = "";
  for (let i = 0; i < row.length; i++) {
    if (i > 0) result = result.concat(fieldSep);
    result = result.concat(row[i]);
  }
  return result.concat(lineSep);
}

/**
 * Join fields with a separator and add a line terminator.
 * Optimized using string.concat() for better performance.
 * @param rows Array of rows (each row is an array of field values)
 * @param fieldSep Field separator (e.g., "\t" for TSV)
 * @param lineSep Line separator (e.g., "\n")
 * @returns Joined string with all rows
 */
export function joinRows(
  rows: string[][],
  fieldSep: string,
  lineSep: string,
): string {
  let result = "";
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) result = result.concat(fieldSep);
      result = result.concat(row[i]);
    }
    result = result.concat(lineSep);
  }
  return result;
}

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

/** One row in the LazyRow binary format. */
export function toBinaryRow(row: Row | LazyRow): Uint8Array {
  return (row instanceof LazyRow ? row : LazyRow.fromStringArray(row))
    .toBinary();
}

/** Length-prefix binary rows and join them, as a LazyRow binary stream. */
export function frameBinaryRows(rows: Uint8Array[]): Uint8Array {
  let size = 0;
  for (const row of rows) size += 4 + row.length;

  const framed = new Uint8Array(size);
  const view = new DataView(framed.buffer);
  let offset = 0;
  for (const row of rows) {
    view.setUint32(offset, row.length, true);
    framed.set(row, offset + 4);
    offset += 4 + row.length;
  }
  return framed;
}

/** A byte lookup table naming the bytes a format can't hold in a field. */
export function forbiddenBytes(names: Record<number, string>): string[] {
  const table: string[] = new Array(256);
  for (const [byte, name] of Object.entries(names)) table[Number(byte)] = name;
  return table;
}

/** Throw if a field holds a byte the format can't represent. */
export function checkFields(
  fields: string[],
  forbidden: string[],
  format: string,
  rowNumber: number,
): void {
  for (let f = 0; f < fields.length; f++) {
    const field = fields[f];
    for (let i = 0; i < field.length; i++) {
      const code = field.charCodeAt(i);
      if (code < 128 && forbidden[code] != null) {
        throw invalidCharacter(forbidden[code], format, rowNumber, f);
      }
    }
  }
}

/**
 * Throw if a field of a binary row holds a byte the format can't represent.
 * Scanning bytes is enough: in UTF-8, a byte below 0x80 always stands for
 * itself.
 */
export function checkBinaryFields(
  rowData: Uint8Array,
  forbidden: string[],
  format: string,
  rowNumber: number,
): void {
  const view = new DataView(
    rowData.buffer,
    rowData.byteOffset,
    rowData.byteLength,
  );
  const fieldCount = view.getUint32(0, true);
  let pos = 4 + fieldCount * 4;
  for (let f = 0; f < fieldCount; f++) {
    const end = pos + view.getUint32(4 + f * 4, true);
    for (let i = pos; i < end; i++) {
      const name = forbidden[rowData[i]];
      if (name != null) throw invalidCharacter(name, format, rowNumber, f);
    }
    pos = end;
  }
}

function invalidCharacter(
  name: string,
  format: string,
  rowNumber: number,
  fieldIndex: number,
): Error {
  return new Error(
    `Invalid character (${name}) in ${format} data at row ${rowNumber.toLocaleString()}, field ${
      fieldIndex + 1
    }`,
  );
}
