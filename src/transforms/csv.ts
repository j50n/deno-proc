import type { TransformerFunction } from "../transformers.ts";
import type { LazyRow } from "./lazy-row.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import type { Row } from "./types.ts";
import { asRows, frameBinaryRows, toBinaryRow } from "./common.ts";

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
 * Parse CSV bytes into batches of string arrays.
 *
 * Uses high-performance WebAssembly parser with RFC 4180 compliance.
 * Streams CSV data efficiently, yielding batches of parsed rows.
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
 * Parse CSV bytes into batches of LazyRow objects.
 *
 * Uses high-performance WebAssembly parser with RFC 4180 compliance.
 * Returns {@link LazyRow} objects for better performance when you only
 * need to access specific fields.
 *
 * **Performance**: Up to 1.7x faster than `fromCsvToRows` for large datasets
 * when accessing only a subset of fields.
 *
 * @example Efficient field access
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToLazyRows } from "jsr:@j50n/proc/transforms";
 *
 * await read("large.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter(row => row.getField(0) === "active")
 *   .forEach(row => console.log(row.getField(1)));
 * ```
 *
 * @param parseOptions CSV parsing options.
 * @returns A transformer function for use with `.transform()`.
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
 * Convert row data to CSV bytes.
 *
 * Uses high-performance WebAssembly with RFC 4180 compliance.
 * Accepts string arrays, batches of string arrays, LazyRow objects,
 * or batches of LazyRow objects.
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
 * @example Convert TSV to CSV
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromTsvToLazyRows, toCsv } from "jsr:@j50n/proc/transforms";
 *
 * await read("data.tsv")
 *   .transform(fromTsvToLazyRows())
 *   .transform(toCsv())
 *   .writeTo("data.csv");
 * ```
 *
 * @param stringifyOptions CSV output options.
 * @returns A transformer function for use with `.transform()`.
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
