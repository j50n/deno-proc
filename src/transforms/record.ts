import {
  BATCH_SIZE_BYTES,
  FIELD_SEPARATOR,
  RECORD_SEPARATOR,
  rowsToRecord,
  rowToRecord,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

/**
 * Parse Record format bytes into batches of string arrays.
 *
 * Record format uses ASCII control characters (RS=0x1E, US=0x1F) as separators,
 * making it binary-safe and faster to parse than CSV/TSV.
 *
 * **Performance**: Record format achieves ~93 MB/s, the fastest of all formats.
 *
 * @example Basic Record parsing
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromRecordToRows } from "jsr:@j50n/proc/transforms";
 *
 * const rows = await read("data.record")
 *   .transform(fromRecordToRows())
 *   .flatten()
 *   .collect();
 * // string[][] - each inner array is one row
 * ```
 *
 * @returns A transformer function for use with `.transform()`.
 */
export function fromRecordToRows() {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<Row[]> {
    let buffer = "";
    let currentBatch: Row[] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });

      const records = buffer.split(RECORD_SEPARATOR);
      buffer = records.pop() || "";

      for (const record of records) {
        if (!record) continue;

        const fields = record.split(FIELD_SEPARATOR);
        currentBatch.push(fields);
        currentBatchSize += record.length;

        if (currentBatchSize >= BATCH_SIZE_BYTES) {
          yield currentBatch;
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer) {
      const fields = buffer.split(FIELD_SEPARATOR);
      currentBatch.push(fields);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

/**
 * Parse Record format bytes into batches of LazyRow objects.
 *
 * Like {@link fromRecordToRows} but returns {@link LazyRow} objects for better
 * performance when accessing only specific fields.
 *
 * @example Efficient field access
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromRecordToLazyRows } from "jsr:@j50n/proc/transforms";
 *
 * await read("large.record")
 *   .transform(fromRecordToLazyRows())
 *   .flatten()
 *   .filter(row => row.getField(0) === "active")
 *   .forEach(row => console.log(row.getField(1)));
 * ```
 *
 * @returns A transformer function for use with `.transform()`.
 */
export function fromRecordToLazyRows() {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<LazyRow[]> {
    let buffer = "";
    let currentBatch: LazyRow[] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });

      const records = buffer.split(RECORD_SEPARATOR);
      buffer = records.pop() || "";

      for (const record of records) {
        if (!record) continue;

        const fields = record.split(FIELD_SEPARATOR);
        const row = LazyRow.fromStringArray(fields);

        currentBatch.push(row);
        currentBatchSize += record.length;

        if (currentBatchSize >= BATCH_SIZE_BYTES) {
          yield currentBatch;
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer) {
      const fields = buffer.split(FIELD_SEPARATOR);
      const row = LazyRow.fromStringArray(fields);
      currentBatch.push(row);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

/**
 * Convert row data to Record format bytes.
 *
 * Accepts batches of string arrays or LazyRow objects. Produces binary-safe
 * output using ASCII control characters as separators.
 *
 * @example Write Record file
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToRows } from "jsr:@j50n/proc/transforms";
 * import { toRecord } from "jsr:@j50n/proc/transforms";
 *
 * // Convert CSV to faster Record format
 * await read("data.csv")
 *   .transform(fromCsvToRows())
 *   .transform(toRecord())
 *   .writeTo("data.record");
 * ```
 *
 * @returns A transformer function for use with `.transform()`.
 */
export function toRecord() {
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    for await (const item of data) {
      if (Array.isArray(item)) {
        if (item.length === 0) continue;

        const first = item[0];

        if (Array.isArray(first)) {
          // Row[]
          yield encoder.encode(rowsToRecord(item as Row[]));
        } else if (first instanceof LazyRow) {
          // LazyRow[]
          const rows = (item as LazyRow[]).map((row) => row.toStringArray());
          yield encoder.encode(rowsToRecord(rows));
        } else {
          // Row (single string[])
          yield encoder.encode(rowToRecord(item as Row));
        }
      } else if (item instanceof LazyRow) {
        // Single LazyRow
        yield encoder.encode(rowToRecord(item.toStringArray()));
      }
    }
  };
}
