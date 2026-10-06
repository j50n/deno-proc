/**
 * Read and write tabular data as streams of rows: CSV, TSV, JSON lines, and a
 * record format meant for passing rows between programs.
 *
 * Each function returns a transformer for `.transform()`. A parser takes bytes
 * (from `read()` in `@j50n/proc`, a process's stdout, or any async iterable
 * of `Uint8Array`) and yields rows; a writer takes rows and yields bytes, ready
 * for `.writeTo()` or the stdin of the next process.
 *
 * ## Formats
 *
 * - **CSV**: RFC 4180, with quoted fields and a configurable separator.
 *   {@link fromCsvToRows}, {@link fromCsvToLazyRows}, {@link toCsv}.
 *   {@link csvToTsv} and {@link tsvToCsv} convert bytes to bytes without
 *   making rows.
 * - **TSV**: a tab between fields, a line feed after each row, no quoting.
 *   {@link fromTsvToRows}, {@link fromTsvToLazyRows}, {@link toTsv}.
 * - **JSON lines**: one JSON value per line. Values, not rows.
 *   {@link fromJsonToRows}, {@link toJson}.
 * - **Record**: {@link FIELD_SEPARATOR} (`\x1F`) between fields and
 *   {@link RECORD_SEPARATOR} (`\x1E`) after each record, no quoting. A field
 *   can hold anything else, tabs and newlines included, and a program in any
 *   language can split it with two calls. {@link fromRecordToRows},
 *   {@link fromRecordToLazyRows}, {@link toRecord}.
 *
 * None of the formats has a header row. A header is the first row, like any
 * other; `.drop(1)` skips it.
 *
 * ## Row or LazyRow
 *
 * A {@link Row} is a `string[]`: every field is decoded when the row is parsed.
 * A {@link LazyRow} from {@link fromCsvToLazyRows} or {@link fromTsvToLazyRows}
 * keeps the row's bytes and decodes a field only when you call `getField`;
 * `fieldEquals` compares a field without decoding it. Pick LazyRow when you
 * filter on or read a few fields of each row; pick Row otherwise, since it is
 * a plain array. Every writer takes either.
 *
 * ## Batches
 *
 * Parsers yield batches (arrays of rows), not single rows, so add `.flatten()`
 * to work row by row. The row writers take a single row or a batch per item,
 * and {@link toJson} takes one value per item, so flatten before it. Each item
 * becomes one chunk of bytes.
 *
 * ## Errors
 *
 * A reader or writer throws rather than drop or change a row or field. A
 * writer refuses a field its format can't hold: {@link toTsv} and
 * {@link csvToTsv} refuse a tab, CR, or LF in a field, and {@link toRecord}
 * refuses `\x1E` or `\x1F`; {@link toCsv} quotes instead. Every row writer
 * refuses a row that would read back as no row or a different one (a row with
 * no fields, and in TSV a row of one empty field) and a lone surrogate, which
 * UTF-8 can't hold. The CSV and TSV parsers take lines ending in LF or CRLF
 * and refuse any other CR outside a quoted field, a file with CR-only line
 * ends included, and the CSV parser refuses a quote still open at the end of
 * the input. The `Error` names the row (and field), counted from 1, as in
 * `Invalid character (tab) in TSV data at row 2, field 1`. Invalid UTF-8 in
 * the input throws a `TypeError` when it is decoded. Otherwise the CSV parser
 * is lenient; see {@link fromCsvToRows}.
 *
 * @example Keep the active rows of a CSV file, as TSV
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows, toTsv } from "@j50n/proc/transforms";
 *
 * await read("people.csv")
 *   .transform(fromCsvToRows())
 *   .flatten()
 *   .filter((row) => row[2] === "active")
 *   .transform(toTsv())
 *   .writeTo("active.tsv");
 * ```
 *
 * @experimental The API may still change.
 *
 * @module
 */

// Core types
export type { Row } from "./types.ts";

// Transform functions for data format conversion
export { LazyRow } from "./lazy-row.ts";
export {
  BATCH_SIZE_BYTES,
  FIELD_SEPARATOR,
  RECORD_SEPARATOR,
} from "./common.ts";

// CSV transformers
export {
  type CsvParseOptions,
  type CsvStringifyOptions,
  csvToTsv,
  fromCsvToLazyRows,
  fromCsvToRows,
  toCsv,
  tsvToCsv,
} from "./csv.ts";

// TSV transformers
export { fromTsvToLazyRows, fromTsvToRows, toTsv } from "./tsv.ts";

// Record transformers
export { fromRecordToLazyRows, fromRecordToRows, toRecord } from "./record.ts";

// JSON transformers
export {
  fromJsonToRows,
  type JsonOptions,
  toJson,
  type ZodSchema,
} from "./json.ts";
