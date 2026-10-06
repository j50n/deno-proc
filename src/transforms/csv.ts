import type { TransformerFunction } from "../transformers.ts";
import {
  convertCsvToTsv,
  convertTsvToCsv,
  readRows,
} from "../wasm/flatdata.ts";
import { type LazyRow, lazyRows } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { batchRows, rowWriter } from "./common.ts";

/** Options for {@link fromCsvToRows}, {@link fromCsvToLazyRows}, and {@link csvToTsv}. */
export interface CsvParseOptions {
  /**
   * The field separator: one ASCII character other than `"`, CR, or LF.
   * Default `","`. Anything else throws a `RangeError` from the call that
   * takes the options.
   */
  separator?: string;
}

/** Options for {@link toCsv} and {@link tsvToCsv}. */
export interface CsvStringifyOptions {
  /**
   * The field separator: one ASCII character other than `"`, CR, or LF.
   * Default `","`. Anything else throws a `RangeError` from the call that
   * takes the options.
   */
  separator?: string;
  /** End each row with CRLF instead of LF. Default `false`. */
  crlf?: boolean;
}

/** The separator, after checking that CSV can use it. */
function csvSeparator(separator: unknown = ","): string {
  if (
    typeof separator !== "string" || separator.length !== 1 ||
    separator.charCodeAt(0) > 127 || separator === '"' ||
    separator === "\n" || separator === "\r"
  ) {
    throw new RangeError(
      `CSV separator must be one ASCII character other than a quote, CR, or LF; got ${
        typeof separator === "string"
          ? JSON.stringify(separator)
          : String(separator)
      }`,
    );
  }
  return separator;
}

/**
 * Parse CSV into batches of rows, each row a `string[]`.
 *
 * The parser runs in WebAssembly, and each batch holds the rows of about
 * 128 KiB of input; add `.flatten()` to work row by row. There is no header
 * handling: the first row is data like the rest.
 *
 * It reads RFC 4180, and where the RFC leaves room:
 *
 * - A quoted field can hold separators, line breaks, and quotes doubled
 *   (`""`).
 * - Rows end in LF or CRLF. Blank lines are skipped; a line holding only `""`
 *   is a row of one empty field.
 * - Rows can have different numbers of fields, and spaces around fields are
 *   kept.
 * - A quote opens a quoted field only at the start of a field. Anywhere else
 *   it is text: `a"b` reads as `a"b`, and `"ab"cd` as `abcd`.
 * - A UTF-8 byte order mark at the start is dropped.
 *
 * Outside quotes, a CR anywhere but right before LF throws an `Error` naming
 * the row and field, counted from 1:
 * `Invalid character (CR) in CSV data at row 3, field 2`. So does a CR that
 * ends the input, and so a file with CR-only line ends fails at its first
 * line. Inside quotes a CR is text. A quote still open at the end of the
 * input throws an `Error` naming the row and field where it opened:
 * `Unclosed quote in CSV data at row 7, field 1`. A row is held whole until
 * it ends, so the rows after an unclosed quote are held in memory until the
 * end of the input; a row too large for the WebAssembly module's memory
 * throws `Row too large for the WebAssembly module's memory in CSV data at
 * row 7`. Invalid UTF-8 throws a `TypeError`. Each error comes after the
 * batches before the one that holds it.
 *
 * @example Read a CSV file
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows } from "@j50n/proc/transforms";
 *
 * const rows: string[][] = await read("data.csv")
 *   .transform(fromCsvToRows())
 *   .flatten()
 *   .collect();
 * ```
 *
 * @example Semicolon-separated, skipping the header
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows } from "@j50n/proc/transforms";
 *
 * const names = await read("data.csv")
 *   .transform(fromCsvToRows({ separator: ";" }))
 *   .flatten()
 *   .drop(1)
 *   .map((row) => row[0])
 *   .collect();
 * ```
 *
 * @param parseOptions The separator.
 * @returns A transformer for `.transform()`.
 * @throws {RangeError} At the call, if the separator can't be used.
 */
export function fromCsvToRows(
  parseOptions?: CsvParseOptions,
): TransformerFunction<Uint8Array, string[][]> {
  const separator = csvSeparator(parseOptions?.separator).charCodeAt(0);
  return async function* (bytes) {
    for await (const batch of readRows(bytes, separator, true)) {
      yield batchRows(batch);
    }
  };
}

/**
 * Parse CSV into batches of {@link LazyRow}s, which decode a field only when
 * you read it.
 *
 * Parsing is the same as in {@link fromCsvToRows}, errors included, except
 * that invalid UTF-8 throws its `TypeError` only when it is decoded, by
 * `getField` or `toStringArray`. Use this when a pipeline reads a few fields
 * of each row, such as a filter: `getField` decodes just that field, and
 * {@link LazyRow.fieldEquals} compares bytes without making a string at all.
 *
 * @example Print the second field of rows whose first is "active"
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToLazyRows } from "@j50n/proc/transforms";
 *
 * await read("large.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.fieldEquals(0, "active"))
 *   .forEach((row) => console.log(row.getField(1)));
 * ```
 *
 * @param parseOptions The separator.
 * @returns A transformer for `.transform()`.
 * @throws {RangeError} At the call, if the separator can't be used.
 */
export function fromCsvToLazyRows(
  parseOptions?: CsvParseOptions,
): TransformerFunction<Uint8Array, LazyRow[]> {
  const separator = csvSeparator(parseOptions?.separator).charCodeAt(0);
  return async function* (bytes) {
    for await (const batch of readRows(bytes, separator, true)) {
      yield lazyRows(batch);
    }
  };
}

/**
 * Write rows as CSV.
 *
 * Each item is a row or a batch of rows, as {@link Row}s or {@link LazyRow}s,
 * and may differ from the one before. Each yields one chunk of bytes; an
 * item `[]` is an empty batch. A field holding the separator, `"`, CR, or LF
 * is quoted, with quotes doubled; others are written as they are. A row of
 * one empty field is written as `""`, since an empty line would read back as
 * no row, and a first field starting with U+FEFF is quoted, since readers
 * drop a byte order mark at the start. Rows end with LF, or CRLF with
 * `crlf: true`.
 *
 * Two things throw an `Error` naming the row, counted from 1: a row with no
 * fields (a `[]` inside a batch, or a LazyRow with none), which CSV can't
 * write so that it reads back, as in
 * `Invalid row (no fields) in CSV data at row 3`; and a field holding a lone
 * surrogate, which UTF-8 can't hold, as in
 * `Invalid character (lone surrogate) in CSV data at row 3, field 2`. Items
 * before it have already been written.
 *
 * @example Rows built in code, with CRLF line ends
 * ```ts
 * import { enumerate } from "@j50n/proc";
 * import { toCsv } from "@j50n/proc/transforms";
 *
 * await enumerate([["name", "note"], ["Ann", 'says "hi", twice']])
 *   .transform(toCsv({ crlf: true }))
 *   .writeTo("notes.csv");
 * ```
 *
 * @param stringifyOptions The separator and line ending.
 * @returns A transformer for `.transform()`.
 * @throws {RangeError} At the call, if the separator can't be used.
 */
export function toCsv(
  stringifyOptions?: CsvStringifyOptions,
): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array<ArrayBuffer>
> {
  const separator = csvSeparator(stringifyOptions?.separator);
  const lineEnd = stringifyOptions?.crlf ? "\r\n" : "\n";
  const needsQuotes = new RegExp(
    `[${separator.replace(/[\\\]^-]/, "\\$&")}"\r\n]`,
  );

  return rowWriter("CSV", (fields, rowNumber) => {
    if (fields.length === 1 && fields[0] === "") return '""' + lineEnd;
    let line = "";
    for (let i = 0; i < fields.length; i++) {
      if (i > 0) line += separator;
      const field = fields[i];
      line += needsQuotes.test(field) ||
          // A byte order mark first in the output would be dropped on reading.
          (rowNumber === 1 && i === 0 && field.startsWith("\uFEFF"))
        ? `"${field.replaceAll('"', '""')}"`
        : field;
    }
    return line + lineEnd;
  });
}

/**
 * Convert CSV to TSV, bytes to bytes, without making rows: several times
 * faster than {@link fromCsvToRows} into {@link toTsv}.
 *
 * CSV is read as {@link fromCsvToRows} reads it, errors included. TSV can't
 * hold a tab, CR, or LF in a field, so a CSV field holding one throws an
 * `Error`, as `toTsv` does: `Invalid character (tab) in TSV data at row 2,
 * field 1`. Nor can it hold a row of one empty field (`""` on a line), which
 * would be a blank line: `Invalid row (one empty field) in TSV data at row 4`.
 * A first field starting with U+FEFF would be dropped by a TSV reader as a
 * byte order mark, so it throws as well. Whichever error comes first in the
 * input is the one thrown, so an unclosed quote whose field takes in a line
 * break reports the LF. The output of the
 * 128 KiB chunks of input before the one holding it has already been passed
 * on, and can end partway through a row. To keep such data, go through rows
 * and replace the characters on the way to `toTsv`.
 *
 * Fields are copied as bytes, not decoded, so invalid UTF-8 passes through
 * to the output unchanged instead of throwing.
 *
 * @example
 * ```ts
 * import { read } from "@j50n/proc";
 * import { csvToTsv } from "@j50n/proc/transforms";
 *
 * await read("data.csv").transform(csvToTsv()).writeTo("data.tsv");
 * ```
 *
 * @param parseOptions The CSV separator.
 * @returns A transformer for `.transform()`.
 * @throws {RangeError} At the call, if the separator can't be used.
 */
export function csvToTsv(
  parseOptions?: CsvParseOptions,
): TransformerFunction<Uint8Array, Uint8Array<ArrayBuffer>> {
  const separator = csvSeparator(parseOptions?.separator).charCodeAt(0);
  return (bytes) => convertCsvToTsv(bytes, separator);
}

/**
 * Convert TSV to CSV, bytes to bytes, without making rows: several times
 * faster than {@link fromTsvToRows} into {@link toCsv}.
 *
 * TSV is read as {@link fromTsvToRows} reads it, CR errors included, and
 * fields are quoted as {@link toCsv} quotes them, a first field starting with
 * U+FEFF included. Fields are copied as bytes,
 * not decoded, so invalid UTF-8 passes through to the output unchanged
 * instead of throwing. A field too large for the WebAssembly module's memory
 * throws `Field too large for the WebAssembly module's memory in TSV data at
 * row 2`, since the module holds each field whole.
 *
 * @example
 * ```ts
 * import { read } from "@j50n/proc";
 * import { tsvToCsv } from "@j50n/proc/transforms";
 *
 * await read("data.tsv").transform(tsvToCsv()).writeTo("data.csv");
 * ```
 *
 * @param stringifyOptions The CSV separator and line ending.
 * @returns A transformer for `.transform()`.
 * @throws {RangeError} At the call, if the separator can't be used.
 */
export function tsvToCsv(
  stringifyOptions?: CsvStringifyOptions,
): TransformerFunction<Uint8Array, Uint8Array<ArrayBuffer>> {
  const separator = csvSeparator(stringifyOptions?.separator).charCodeAt(0);
  const crlf = stringifyOptions?.crlf ?? false;
  return (bytes) => convertTsvToCsv(bytes, separator, crlf);
}
