import { LazyRow } from "./lazy-row.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";

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
export function fromCsvToRows(parseOptions?: CsvParseOptions) {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<string[][]> {
    const processor = await FlatdataProcessor.create();
    const separator = parseOptions?.separator?.charCodeAt(0) ?? 44;
    const lazyRowStream = processor.csvToLazyRowsStreaming(bytes, separator);
    
    for await (const batch of lazyRowStream) {
      yield batch.map(row => row.toStringArray());
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
export function fromCsvToLazyRows(parseOptions?: CsvParseOptions) {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<LazyRow[]> {
    const processor = await FlatdataProcessor.create();
    const separator = parseOptions?.separator?.charCodeAt(0) ?? 44;
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
export function toCsv(stringifyOptions?: CsvStringifyOptions) {
  return async function* (
    data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const processor = await FlatdataProcessor.create();
    
    async function* toRecordFormat() {
      const encoder = new TextEncoder();
      for await (const item of data) {
        const rows = normalizeRows(item);
        const parts: string[] = [];
        for (const row of rows) {
          parts.push(row.join(String.fromCharCode(0x1F)));
          parts.push(String.fromCharCode(0x1E));
        }
        yield encoder.encode(parts.join(""));
      }
    }
    
    const separator = stringifyOptions?.separator?.charCodeAt(0) ?? 44;
    const crlf = stringifyOptions?.crlf ?? false;
    yield* processor.recordToCsvStreaming(toRecordFormat(), separator, crlf);
  };
}

function normalizeRows(
  item: string[] | string[][] | LazyRow | LazyRow[],
): string[][] {
  if (item instanceof LazyRow) {
    return [item.toStringArray()];
  }
  if (Array.isArray(item) && item.length > 0) {
    if (item[0] instanceof LazyRow) {
      return (item as LazyRow[]).map((r) => r.toStringArray());
    }
    if (Array.isArray(item[0])) {
      return item as string[][];
    }
    return [item as string[]];
  }
  return [];
}
