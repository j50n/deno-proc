import {
  BATCH_SIZE_BYTES,
  FIELD_SEPARATOR,
  RECORD_SEPARATOR,
  rowsToRecord,
  rowToRecord,
  writeUint32LE,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import { concat } from "../utility.ts";

const decode = (() => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return decoder.decode.bind(decoder);
})();

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
      buffer += decode(chunk, { stream: true });

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

    buffer += decode();
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
      buffer += decode(chunk, { stream: true });

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

    buffer += decode();
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
    const encode = (() => {
      const encoder = new TextEncoder();
      return encoder.encode.bind(encoder);
    })();
    const processor = await FlatdataProcessor.create();

    const handleRow = (row: Row): Uint8Array => {
      return encode(rowToRecord(row));
    };

    const handleRowArray = (rows: Row[]): Uint8Array => {
      return encode(rowsToRecord(rows));
    };

    const handleBinaryLazyRow = (row: LazyRow): Uint8Array => {
      const rowData = row.toBinary();
      return processor.lazyRowBinaryToRecordDirect(
        concat([writeUint32LE(rowData.length), rowData]),
      );
    };

    const handleStringLazyRow = (row: LazyRow): Uint8Array => {
      return encode(rowToRecord(row.toStringArray()));
    };

    const handleBinaryLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const chunks = new Array(rows.length * 2);
      let idx = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i].toBinary();
        chunks[idx++] = writeUint32LE(rowData.length);
        chunks[idx++] = rowData;
      }

      return processor.lazyRowBinaryToRecordDirect(concat(chunks));
    };

    const handleStringLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const stringRows = rows.map((row) => row.toStringArray());
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
