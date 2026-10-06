import type { TransformerFunction } from "../transformers.ts";
import {
  convertCsvToTsv,
  convertTsvToCsv,
  readRows,
} from "../wasm/flatdata.ts";
import { type LazyRow, lazyRows } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { batchRows, rowWriter } from "./common.ts";

/**
 * Options for parsing CSV data.
 */
export interface CsvParseOptions {
  /** Field separator character. Defaults to comma. */
  separator?: string;
}

/**
 * Options for stringifying data to CSV.
 */
export interface CsvStringifyOptions {
  /** Field separator character. Defaults to comma. */
  separator?: string;
  /** Use CRLF line endings instead of LF. */
  crlf?: boolean;
}

/** The separator, after checking that CSV can use it. */
function csvSeparator(separator = ","): string {
  const code = separator.charCodeAt(0);
  if (
    separator.length !== 1 || code > 127 || separator === '"' ||
    separator === "\n" || separator === "\r"
  ) {
    throw new RangeError(
      `CSV separator must be one ASCII character other than a quote, CR, or LF; got ${
        JSON.stringify(separator)
      }`,
    );
  }
  return separator;
}

/**
 * Parse CSV bytes into batches of string arrays.
 *
 * How it reads CSV, where RFC 4180 leaves room: a quote opens a quoted field
 * only at the start of a field, and is content anywhere else; lines end in LF
 * or CRLF; blank lines are skipped; a quote left open at the end of the input
 * ends there. A UTF-8 byte order mark at the start is dropped.
 *
 * Invalid UTF-8 is an error, and so is a CR outside quotes anywhere but
 * before LF (a CR-only file, say), naming its row and field. Inside quotes a
 * CR is content. The error comes with the batch that holds it, after the
 * batches before it.
 *
 * The parser is WebAssembly with SIMD; each batch holds the rows of about
 * 128 KB of input.
 *
 * @example Basic CSV parsing
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToRows } from "jsr:@j50n/proc/transforms";
 *
 * const rows = await read("data.csv")
 *   .transform(fromCsvToRows())
 *   .flatten()
 *   .collect();
 * // string[][] - each inner array is one row
 * ```
 *
 * @example With custom separator
 * ```typescript
 * const rows = await read("data.csv")
 *   .transform(fromCsvToRows({ separator: ";" }))
 *   .flatten()
 *   .collect();
 * ```
 *
 * @param parseOptions CSV parsing options.
 * @returns A transformer function for use with `.transform()`.
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
 * Parse CSV bytes into batches of {@link LazyRow} objects.
 *
 * Reads CSV as {@link fromCsvToRows} does, but leaves each field undecoded
 * until it is read. When a pipeline looks at only a few fields of each row,
 * such as a filter, this is several times faster, especially with
 * {@link LazyRow.fieldEquals}.
 *
 * @example Efficient field access
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToLazyRows } from "jsr:@j50n/proc/transforms";
 *
 * await read("large.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.fieldEquals(0, "active"))
 *   .forEach((row) => console.log(row.getField(1)));
 * ```
 *
 * @param parseOptions CSV parsing options.
 * @returns A transformer function for use with `.transform()`.
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
 * Convert row data to CSV bytes.
 *
 * Accepts string arrays, batches of string arrays, LazyRow objects,
 * or batches of LazyRow objects. A field is quoted when it holds the
 * separator, a quote, CR or LF, with quotes doubled. A row of one empty field
 * is written as `""`, since an empty line would read back as no row.
 *
 * @example Write CSV file
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToRows, toCsv } from "jsr:@j50n/proc/transforms";
 *
 * await read("input.csv")
 *   .transform(fromCsvToRows())
 *   .transform(toCsv())
 *   .writeTo("output.csv");
 * ```
 *
 * @param stringifyOptions CSV output options.
 * @returns A transformer function for use with `.transform()`.
 */
export function toCsv(
  stringifyOptions?: CsvStringifyOptions,
): TransformerFunction<Row | Row[] | LazyRow | LazyRow[], Uint8Array> {
  const separator = csvSeparator(stringifyOptions?.separator);
  const lineEnd = stringifyOptions?.crlf ? "\r\n" : "\n";
  const needsQuotes = new RegExp(
    `[${separator.replace(/[\\\]^-]/, "\\$&")}"\r\n]`,
  );

  return rowWriter((fields) => {
    if (fields.length === 1 && fields[0] === "") return '""' + lineEnd;
    let line = "";
    for (let i = 0; i < fields.length; i++) {
      if (i > 0) line += separator;
      const field = fields[i];
      line += needsQuotes.test(field)
        ? `"${field.replaceAll('"', '""')}"`
        : field;
    }
    return line + lineEnd;
  });
}

/**
 * Convert CSV bytes straight to TSV bytes, all in WebAssembly: much faster
 * than parsing to rows and writing them.
 *
 * TSV can't hold a tab, LF or CR inside a field, so a CSV field holding one
 * is an error, as it is for `toTsv`; the rows before it have already
 * been passed on. To keep such data, parse it with {@link fromCsvToRows} and
 * replace the characters on the way to `toTsv`. CSV is read as
 * {@link fromCsvToRows} reads it.
 *
 * @example
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { csvToTsv } from "jsr:@j50n/proc/transforms";
 *
 * await read("data.csv").transform(csvToTsv()).writeTo("data.tsv");
 * ```
 *
 * @param parseOptions CSV parsing options.
 * @returns A transformer function for use with `.transform()`.
 */
export function csvToTsv(
  parseOptions?: CsvParseOptions,
): TransformerFunction<Uint8Array, Uint8Array> {
  const separator = csvSeparator(parseOptions?.separator).charCodeAt(0);
  return (bytes) => convertCsvToTsv(bytes, separator);
}

/**
 * Convert TSV bytes straight to CSV bytes, all in WebAssembly: much faster
 * than parsing to rows and writing them.
 *
 * TSV is read as `fromTsvToRows` reads it, and fields are quoted as
 * {@link toCsv} quotes them.
 *
 * @example
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { tsvToCsv } from "jsr:@j50n/proc/transforms";
 *
 * await read("data.tsv").transform(tsvToCsv()).writeTo("data.csv");
 * ```
 *
 * @param stringifyOptions CSV output options.
 * @returns A transformer function for use with `.transform()`.
 */
export function tsvToCsv(
  stringifyOptions?: CsvStringifyOptions,
): TransformerFunction<Uint8Array, Uint8Array> {
  const separator = csvSeparator(stringifyOptions?.separator).charCodeAt(0);
  const crlf = stringifyOptions?.crlf ?? false;
  return (bytes) => convertTsvToCsv(bytes, separator, crlf);
}
