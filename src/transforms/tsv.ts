import type { TransformerFunction } from "../transformers.ts";
import { readRows } from "../wasm/flatdata.ts";
import {
  batchRows,
  checkFields,
  checkNoLeadingBom,
  invalidRow,
  rowWriter,
} from "./common.ts";
import { type LazyRow, lazyRows } from "./lazy-row.ts";
import type { Row } from "./types.ts";

const TAB = 0x09;
const TSV_FORBIDDEN = /[\t\n\r]/;

/**
 * Parse TSV into batches of rows, each row a `string[]`.
 *
 * Each line is one row, split on tabs. There is no quoting: quotes are text.
 * Lines end in LF or CRLF, blank lines are skipped, and the last line needs
 * no LF. A UTF-8 byte order mark at the start is dropped. There is no header
 * handling: the first row is data like the rest. The parser runs in
 * WebAssembly, and each batch holds the rows of about 128 KiB of input; add
 * `.flatten()` to work row by row.
 *
 * A CR anywhere but right before LF throws an `Error` naming the row and
 * field, counted from 1: `Invalid character (CR) in TSV data at row 3, field 2`.
 * So does a CR that ends the input, and so a file with CR-only line ends fails
 * at its first line. Invalid UTF-8 throws a `TypeError`. Either error comes
 * after the batches before the one that holds it.
 *
 * @example Print the first field of each row whose third is "active"
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromTsvToRows } from "@j50n/proc/transforms";
 *
 * await read("users.tsv")
 *   .transform(fromTsvToRows())
 *   .flatten()
 *   .filter((row) => row[2] === "active")
 *   .forEach((row) => console.log(row[0]));
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function fromTsvToRows(): TransformerFunction<Uint8Array, Row[]> {
  return async function* (bytes) {
    for await (const batch of readRows(bytes, TAB, false)) {
      yield batchRows(batch);
    }
  };
}

/**
 * Parse TSV into batches of {@link LazyRow}s, which decode a field only when
 * you read it.
 *
 * Parsing is the same as in {@link fromTsvToRows}, errors included, except
 * that invalid UTF-8 throws its `TypeError` only when it is decoded, by
 * `getField` or `toStringArray`. Use this when a pipeline reads a few fields
 * of each row, such as a filter: `getField` decodes just that field, and
 * {@link LazyRow.fieldEquals} compares bytes without making a string at all.
 *
 * @example
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromTsvToLazyRows } from "@j50n/proc/transforms";
 *
 * await read("log.tsv")
 *   .transform(fromTsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.fieldEquals(2, "ERROR"))
 *   .forEach((row) => console.log(row.getField(0)));
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function fromTsvToLazyRows(): TransformerFunction<
  Uint8Array,
  LazyRow[]
> {
  return async function* (bytes) {
    for await (const batch of readRows(bytes, TAB, false)) {
      yield lazyRows(batch);
    }
  };
}

/**
 * Write rows as TSV: fields joined by tabs, each row ended by LF.
 *
 * TSV has no quoting, so a field can't hold a tab, CR, or LF. One that does
 * throws an `Error` naming the row and field, counted from 1:
 * `Invalid character (tab) in TSV data at row 2, field 1`. A row that would
 * be written as a blank line, which reads back as no row, throws too: a row
 * of one empty field (`[""]`) with
 * `Invalid row (one empty field) in TSV data at row 3`, and a row with no
 * fields (a `[]` inside a batch) with `Invalid row (no fields) ...`. So do a
 * lone surrogate, which UTF-8 can't hold, and a first field starting with
 * U+FEFF, which a reader would drop as a byte order mark. Items before the
 * one that throws have already been written. For such data, use
 * {@link toCsv} or {@link toRecord}.
 *
 * Each item is a row or a batch of rows, as {@link Row}s or {@link LazyRow}s,
 * and may differ from the one before. Each yields one chunk of bytes; an
 * item `[]` is an empty batch. To turn CSV bytes into TSV, {@link csvToTsv}
 * does it without making rows.
 *
 * @example Write rows built in code
 * ```ts
 * import { enumerate } from "@j50n/proc";
 * import { toTsv } from "@j50n/proc/transforms";
 *
 * await enumerate([["name", "age"], ["Ann", "34"]])
 *   .transform(toTsv())
 *   .writeTo("people.tsv");
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function toTsv(): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array<ArrayBuffer>
> {
  return rowWriter("TSV", (fields, rowNumber) => {
    if (fields.length === 1 && fields[0] === "") {
      throw invalidRow("one empty field", "TSV", rowNumber);
    }
    checkFields(fields, TSV_FORBIDDEN, "TSV", rowNumber);
    checkNoLeadingBom(fields, "TSV", rowNumber);
    let line = "";
    for (let i = 0; i < fields.length; i++) {
      if (i > 0) line += "\t";
      line += fields[i];
    }
    return line + "\n";
  });
}
