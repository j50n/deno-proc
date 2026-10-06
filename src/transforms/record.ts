import type { TransformerFunction } from "../transformers.ts";
import {
  BATCH_SIZE_BYTES,
  checkFields,
  FIELD_SEPARATOR,
  RECORD_SEPARATOR,
  rowWriter,
  splitText,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";

const RECORD_FORBIDDEN = new RegExp(`[${RECORD_SEPARATOR}${FIELD_SEPARATOR}]`);

/** Batch the parsed records of a record-format stream. */
async function* recordBatches<T>(
  bytes: AsyncIterable<Uint8Array>,
  toRow: (fields: string[]) => T,
): AsyncIterable<T[]> {
  let currentBatch: T[] = [];
  let currentBatchSize = 0;

  for await (const records of splitText(bytes, RECORD_SEPARATOR)) {
    for (const record of records) {
      currentBatch.push(toRow(record.split(FIELD_SEPARATOR)));
      currentBatchSize += record.length;

      if (currentBatchSize >= BATCH_SIZE_BYTES) {
        yield currentBatch;
        currentBatch = [];
        currentBatchSize = 0;
      }
    }
  }

  if (currentBatch.length > 0) {
    yield currentBatch;
  }
}

/**
 * Parse Record format bytes into batches of string arrays.
 *
 * Record format uses ASCII control characters (RS=0x1E, US=0x1F) as
 * separators, so a field can hold any text but those two, and nothing is
 * quoted or escaped.
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
export function fromRecordToRows(): TransformerFunction<Uint8Array, Row[]> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<Row[]> =>
    recordBatches(bytes, (fields) => fields);
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
export function fromRecordToLazyRows(): TransformerFunction<
  Uint8Array,
  LazyRow[]
> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> =>
    recordBatches(bytes, LazyRow.fromStringArray);
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
export function toRecord(): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array
> {
  return rowWriter((fields, rowNumber) => {
    checkFields(fields, RECORD_FORBIDDEN, "record", rowNumber);
    return fields.join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
  });
}
