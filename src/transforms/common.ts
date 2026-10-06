// Constants and helpers shared by the transforms.

import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";

/**
 * The amount of text, about 128 KiB, at which the TSV, record, JSON-lines, and
 * LazyRow binary parsers end a batch. A batch can run over by one row. (The CSV
 * parsers batch by count instead: 100 rows.)
 */
export const BATCH_SIZE_BYTES = 128 * 1024;

/** Ends each record in the record format: `"\x1E"` (ASCII RS). */
export const RECORD_SEPARATOR = "\x1E";

/** Separates the fields of a record in the record format: `"\x1F"` (ASCII US). */
export const FIELD_SEPARATOR = "\x1F";

const uint32Buffer = new Uint8Array(4);
const uint32View = new Uint32Array(uint32Buffer.buffer);

/** `value` as 4 bytes, unsigned little-endian (on little-endian hosts). */
export function writeUint32LE(value: number): Uint8Array {
  uint32View[0] = value;
  return uint32Buffer.slice();
}

/** One row in the record format, `\x1E` included. Fields are not checked. */
export function rowToRecord(row: string[]): string {
  return joinRow(row, FIELD_SEPARATOR, RECORD_SEPARATOR);
}

/** Rows in the record format. Fields are not checked. */
export function rowsToRecord(rows: string[][]): string {
  return joinRows(rows, FIELD_SEPARATOR, RECORD_SEPARATOR);
}

/** Join a row's fields with `fieldSep` and end it with `lineSep`. */
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

/** {@link joinRow} for each row, concatenated. */
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

type Item = Row | Row[] | LazyRow | LazyRow[];

/** A batch of LazyRows backed by binary data (as the CSV parser yields). */
export function isBinaryLazyRowArray(item: Item): item is LazyRow[] {
  return Array.isArray(item) && item[0] instanceof LazyRow &&
    item[0].isBinaryBacked();
}

/** A batch of LazyRows backed by strings. */
export function isStringLazyRowArray(item: Item): item is LazyRow[] {
  return Array.isArray(item) && item[0] instanceof LazyRow &&
    !item[0].isBinaryBacked();
}

/** A batch of string rows. */
export function isRowArray(item: Item): item is Row[] {
  return Array.isArray(item) && Array.isArray(item[0]);
}

/** One string row, with at least one field. */
export function isRow(item: Item): item is Row {
  return Array.isArray(item) && typeof item[0] === "string";
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
