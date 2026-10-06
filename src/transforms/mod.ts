/**
 * Read and write tabular data as streams of rows: CSV, TSV, JSON lines, and two
 * formats meant for passing rows between programs.
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
 * - **TSV**: a tab between fields, a line feed after each row, no quoting.
 *   {@link fromTsvToRows}, {@link fromTsvToLazyRows}, {@link toTsv}.
 * - **JSON lines**: one JSON value per line. Values, not rows.
 *   {@link fromJsonToRows}, {@link toJson}.
 * - **Record**: {@link FIELD_SEPARATOR} (`\x1F`) between fields and
 *   {@link RECORD_SEPARATOR} (`\x1E`) after each record, no quoting. A field
 *   can hold anything else, tabs and newlines included, and a program in any
 *   language can split it with two calls. {@link fromRecordToRows},
 *   {@link fromRecordToLazyRows}, {@link toRecord}.
 * - **LazyRow binary**: length-prefixed fields that can hold any string.
 *   {@link fromLazyRowBinary}, {@link toLazyRowBinary}.
 *
 * None of the formats has a header row. A header is the first row, like any
 * other; `.drop(1)` skips it.
 *
 * ## Row or LazyRow
 *
 * A {@link Row} is a `string[]`: every field is decoded when the row is parsed.
 * A {@link LazyRow} from {@link fromCsvToLazyRows} or {@link fromLazyRowBinary}
 * keeps the row's bytes and decodes a field only when you call `getField`, and
 * a writer passes an unmodified one through without decoding it. Pick LazyRow
 * when you read a few fields of wide rows or copy rows from one format to
 * another; pick Row otherwise, since it is a plain array. Every writer takes
 * either.
 *
 * ## Batches
 *
 * Parsers yield batches (arrays of rows), not single rows, so add `.flatten()`
 * to work row by row. The row writers take a single row or a batch per item,
 * and {@link toJson} takes batches only. Each item becomes one chunk of bytes.
 *
 * ## Errors
 *
 * A writer throws rather than write a field its format can't hold: {@link toTsv}
 * refuses a tab, CR, or LF in a field, and {@link toRecord} refuses `\x1E` or
 * `\x1F`. The `Error` names the row and field, counted from 1, as in
 * `Invalid character (tab) in TSV data at row 2, field 1`. {@link toCsv}
 * refuses nothing; it quotes. Invalid UTF-8 in the input throws a `TypeError`
 * when the field is decoded. The CSV parser never reports malformed input; see
 * {@link fromCsvToRows}.
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
  fromCsvToLazyRows,
  fromCsvToRows,
  toCsv,
} from "./csv.ts";

// TSV transformers
export { fromTsvToLazyRows, fromTsvToRows, toTsv } from "./tsv.ts";

// Record transformers
export { fromRecordToLazyRows, fromRecordToRows, toRecord } from "./record.ts";

// Binary LazyRow transformers
export { fromLazyRowBinary, toLazyRowBinary } from "./lazyrow-binary.ts";

// JSON transformers
export {
  fromJsonToRows,
  type JsonOptions,
  toJson,
  type ZodSchema,
} from "./json.ts";
