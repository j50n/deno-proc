import { LazyRow } from "./lazy-row.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import type { Row } from "./types.ts";
import { rowsToRecord, rowToRecord } from "./common.ts";

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
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const processor = await FlatdataProcessor.create();
    const separator = stringifyOptions?.separator?.charCodeAt(0) ?? 44;
    const crlf = stringifyOptions?.crlf ?? false;
    const encode = (() => {
      const encoder = new TextEncoder();
      return encoder.encode.bind(encoder);
    })();
    const FS = String.fromCharCode(0x1F);
    const RS = String.fromCharCode(0x1E);

    // Handler functions for each input type
    function handleBinaryLazyRowArray(rows: LazyRow[]): Uint8Array {
      // Calculate total size needed
      let totalSize = 0;
      for (const row of rows) {
        const rowData = row.toBinary();
        totalSize += 4 + rowData.length; // 4 bytes for length prefix + row data
      }

      // Allocate once and copy directly
      const binaryData = new Uint8Array(totalSize);
      const view = new DataView(binaryData.buffer);
      let offset = 0;

      for (const row of rows) {
        const rowData = row.toBinary();
        view.setUint32(offset, rowData.length, true);
        offset += 4;
        binaryData.set(rowData, offset);
        offset += rowData.length;
      }

      // Convert binary lazyrow → CSV directly via WASM (single shot)
      return processor.lazyRowBinaryToCsvDirect(binaryData, separator, crlf);
    }

    function handleStringLazyRowArray(rows: LazyRow[]): Uint8Array {
      const record = encode(
        rows.map((row) => row.toStringArray().join(FS)).join(RS) + RS,
      );
      return processor.recordToCsvDirect(record, separator, crlf);
    }

    function handleBinaryLazyRow(row: LazyRow): Uint8Array {
      const rowData = row.toBinary();
      const binaryData = new Uint8Array(4 + rowData.length);
      new DataView(binaryData.buffer).setUint32(0, rowData.length, true);
      binaryData.set(rowData, 4);
      return processor.lazyRowBinaryToCsvDirect(binaryData, separator, crlf);
    }

    function handleStringLazyRow(row: LazyRow): Uint8Array {
      const record = encode(rowToRecord(row.toStringArray()));
      return processor.recordToCsvDirect(record, separator, crlf);
    }

    function handleRowArray(rows: Row[]): Uint8Array {
      const record = encode(rowsToRecord(rows));
      return processor.recordToCsvDirect(record, separator, crlf);
    }

    function handleRow(row: Row): Uint8Array {
      const record = encode(rowToRecord(row));
      return processor.recordToCsvDirect(record, separator, crlf);
    }

    // Select handler on first iteration
    // deno-lint-ignore no-explicit-any
    let handler: (item: any) => Uint8Array = (item: any) => {
      if (Array.isArray(item) && item.length === 0) {
        return new Uint8Array(0);
      }

      if (
        Array.isArray(item) && item.length > 0 &&
        item[0] instanceof LazyRow && item[0].isBinaryBacked()
      ) {
        handler = handleBinaryLazyRowArray;
      } else if (
        Array.isArray(item) && item.length > 0 && item[0] instanceof LazyRow
      ) {
        handler = handleStringLazyRowArray;
      } else if (item instanceof LazyRow && item.isBinaryBacked()) {
        handler = handleBinaryLazyRow;
      } else if (item instanceof LazyRow) {
        handler = handleStringLazyRow;
      } else if (
        Array.isArray(item) && item.length > 0 && Array.isArray(item[0])
      ) {
        handler = handleRowArray;
      } else if (Array.isArray(item)) {
        handler = handleRow;
      } else {
        throw new TypeError(
          `Unsupported input type for toCsv: expected Row, Row[], LazyRow, or LazyRow[], got ${typeof item}`,
        );
      }

      return handler(item);
    };

    for await (const item of data) {
      yield handler(item);
    }
  };
}
