import type { TransformerFunction } from "../transformers.ts";
import {
  BATCH_SIZE_BYTES,
  checkBinaryFields,
  checkFields,
  FIELD_SEPARATOR,
  forbiddenBytes,
  RECORD_SEPARATOR,
  rowsToRecord,
  rowToRecord,
  splitText,
  writeUint32LE,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import { concat } from "../utility.ts";

const RECORD_FORBIDDEN = forbiddenBytes({
  0x1E: "record separator",
  0x1F: "field separator",
});

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
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const encode = (() => {
      const encoder = new TextEncoder();
      return encoder.encode.bind(encoder);
    })();
    const processor = await FlatdataProcessor.create();
    let rowNumber = 0;

    const check = (fields: string[]) =>
      checkFields(fields, RECORD_FORBIDDEN, "record", ++rowNumber);
    const checkBinary = (rowData: Uint8Array) =>
      checkBinaryFields(rowData, RECORD_FORBIDDEN, "record", ++rowNumber);

    const handleRow = (row: Row): Uint8Array => {
      check(row);
      return encode(rowToRecord(row));
    };

    const handleRowArray = (rows: Row[]): Uint8Array => {
      rows.forEach(check);
      return encode(rowsToRecord(rows));
    };

    const handleBinaryLazyRow = (row: LazyRow): Uint8Array => {
      const rowData = row.toBinary();
      checkBinary(rowData);
      return processor.lazyRowBinaryToRecordDirect(
        concat([writeUint32LE(rowData.length), rowData]),
      );
    };

    const handleStringLazyRow = (row: LazyRow): Uint8Array => {
      const fields = row.toStringArray();
      check(fields);
      return encode(rowToRecord(fields));
    };

    const handleBinaryLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const chunks = new Array(rows.length * 2);
      let idx = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i].toBinary();
        checkBinary(rowData);
        chunks[idx++] = writeUint32LE(rowData.length);
        chunks[idx++] = rowData;
      }

      return processor.lazyRowBinaryToRecordDirect(concat(chunks));
    };

    const handleStringLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const stringRows = rows.map((row) => row.toStringArray());
      stringRows.forEach(check);
      return encode(rowsToRecord(stringRows));
    };

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
          `Unsupported input type for toRecord: expected Row, Row[], LazyRow, or LazyRow[], got ${typeof item}`,
        );
      }

      return handler(item);
    };

    for await (const item of data) {
      yield handler(item);
    }
  };
}
