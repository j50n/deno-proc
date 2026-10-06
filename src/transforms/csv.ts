import type { TransformerFunction } from "../transformers.ts";
import type { LazyRow } from "./lazy-row.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import type { Row } from "./types.ts";
import { asRows, frameBinaryRows, toBinaryRow } from "./common.ts";

/** Options for {@link fromCsvToRows} and {@link fromCsvToLazyRows}. */
export interface CsvParseOptions {
  /**
   * The field separator: one ASCII character other than `"`, CR, or LF.
   * Default `","`. Anything else throws a `RangeError` from the call that
   * takes the options.
   */
  separator?: string;
}

/** Options for {@link toCsv}. */
export interface CsvStringifyOptions {
  /**
   * The field separator: one ASCII character other than `"`, CR, or LF.
   * Default `","`. Anything else throws a `RangeError` from `toCsv()`.
   */
  separator?: string;
  /** End each row with CRLF instead of LF. Default `false`. */
  crlf?: boolean;
}

/** The separator as a byte, after checking that CSV can use it. */
function csvSeparator(separator = ","): number {
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
  return code;
}

/**
 * Parse CSV into batches of rows, each row a `string[]`.
 *
 * The parser runs in WebAssembly and yields batches of up to 100 rows; add
 * `.flatten()` to work row by row. There is no header handling: the first row
 * is data like the rest.
 *
 * It reads RFC 4180 and is lenient about the rest. It never reports malformed
 * input:
 *
 * - A quoted field can hold separators, line breaks, and quotes doubled
 *   (`""`).
 * - LF, CRLF, or a lone CR ends a row. Blank lines are skipped.
 * - Rows can have different numbers of fields, and spaces around fields are
 *   kept.
 * - A quote inside an unquoted field is kept as text: `a"b` reads as `a"b`.
 * - An unclosed quote runs to the end of the input, which becomes one field.
 * - Text after a closing quote, as in `"ab" ,c` or `"ab"cd`, stops the parser
 *   without an error. The rest of the input is lost, and so are the rows
 *   already parsed from the same chunk.
 *
 * Invalid UTF-8 throws a `TypeError` as the batch holding it is converted.
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
  const separator = csvSeparator(parseOptions?.separator);
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<string[][]> {
    const processor = await FlatdataProcessor.create();
    const lazyRowStream = processor.csvToLazyRowsStreaming(bytes, separator);

    for await (const batch of lazyRowStream) {
      yield batch.map((row) => row.toStringArray());
    }
  };
}

/**
 * Parse CSV into batches of {@link LazyRow}s, which decode a field only when
 * you read it.
 *
 * The rows are binary-backed: each holds its fields as UTF-8 bytes, and
 * `getField` decodes one. Use this rather than {@link fromCsvToRows} when you
 * read only some fields of each row, or pass rows on to a writer, which takes
 * an unmodified one without decoding it. Parsing is the same as in
 * {@link fromCsvToRows}, malformed-input behavior included. Invalid UTF-8
 * throws a `TypeError` only from the `getField` that decodes it.
 *
 * @example Print the second field of rows whose first is "active"
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToLazyRows } from "@j50n/proc/transforms";
 *
 * await read("large.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.getField(0) === "active")
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
  const separator = csvSeparator(parseOptions?.separator);
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<LazyRow[]> {
    const processor = await FlatdataProcessor.create();
    yield* processor.csvToLazyRowsStreaming(bytes, separator);
  };
}

/**
 * Write rows as CSV.
 *
 * Each item is a row or a batch of rows, as {@link Row}s or {@link LazyRow}s,
 * and may differ from the one before. Each yields one chunk of bytes. A field
 * holding the separator, `"`, CR, or LF is quoted, with quotes doubled; others
 * are written as they are. Rows end with LF, or CRLF with `crlf: true`. No
 * field is refused.
 *
 * @example Convert TSV to CSV
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromTsvToRows, toCsv } from "@j50n/proc/transforms";
 *
 * await read("data.tsv")
 *   .transform(fromTsvToRows())
 *   .transform(toCsv())
 *   .writeTo("data.csv");
 * ```
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
): TransformerFunction<Row | Row[] | LazyRow | LazyRow[], Uint8Array> {
  const separator = csvSeparator(stringifyOptions?.separator);
  const crlf = stringifyOptions?.crlf ?? false;
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const processor = await FlatdataProcessor.create();

    // Every row goes to WASM in the length-prefixed binary format, which can
    // carry any character in a field.
    for await (const item of data) {
      const rows = asRows(item);
      yield rows.length === 0
        ? new Uint8Array(0)
        : processor.lazyRowBinaryToCsvDirect(
          frameBinaryRows(rows.map(toBinaryRow)),
          separator,
          crlf,
        );
    }
  };
}
