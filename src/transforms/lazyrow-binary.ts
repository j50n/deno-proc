import {
  BATCH_SIZE_BYTES,
  rowsToRecord,
  rowToRecord,
  writeUint32LE,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { concat } from "../utility.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";

/**
 * Convert LazyRow or string array batches to binary lazyrow format.
 *
 * Binary lazyrow format:
 * - Each row: [row_length:u32][field_count:u32][field_lengths:u32[]][field_data:bytes]
 * - row_length includes everything after itself
 *
 * @example Write binary lazyrow file
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToRows, toLazyRowBinary } from "jsr:@j50n/proc/transforms";
 *
 * await read("data.csv")
 *   .transform(fromCsvToRows())
 *   .transform(toLazyRowBinary())
 *   .writeTo("data.lazyrow");
 * ```
 */
export function toLazyRowBinary() {
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const encoder = new TextEncoder();
    const processor = await FlatdataProcessor.create();
    const encode = (s: string) => encoder.encode(s);

    // Handler functions for each input type
    function handleBinaryLazyRowArray(rows: LazyRow[]): Uint8Array {
      const chunks = new Array(rows.length * 2);
      let idx = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i].toBinary();
        chunks[idx++] = writeUint32LE(rowData.length);
        chunks[idx++] = rowData;
      }

      return concat(chunks);
    }

    function handleBinaryLazyRow(row: LazyRow): Uint8Array {
      const rowData = row.toBinary();
      return concat([writeUint32LE(rowData.length), rowData]);
    }

    function handleRowArray(rows: Row[]): Uint8Array {
      return processor.recordToLazyRowBinaryDirect(encode(rowsToRecord(rows)));
    }

    function handleStringLazyRowArray(rows: LazyRow[]): Uint8Array {
      const stringRows = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) {
        stringRows[i] = rows[i].toStringArray();
      }
      return processor.recordToLazyRowBinaryDirect(
        encode(rowsToRecord(stringRows)),
      );
    }

    function handleStringLazyRow(row: LazyRow): Uint8Array {
      return processor.recordToLazyRowBinaryDirect(
        encode(rowToRecord(row.toStringArray())),
      );
    }

    function handleRow(row: Row): Uint8Array {
      return processor.recordToLazyRowBinaryDirect(encode(rowToRecord(row)));
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
      } else if (item instanceof LazyRow && item.isBinaryBacked()) {
        handler = handleBinaryLazyRow;
      } else if (
        Array.isArray(item) && item.length > 0 && item[0] instanceof LazyRow
      ) {
        handler = handleStringLazyRowArray;
      } else if (
        Array.isArray(item) && item.length > 0 && Array.isArray(item[0])
      ) {
        handler = handleRowArray;
      } else if (item instanceof LazyRow) {
        handler = handleStringLazyRow;
      } else if (Array.isArray(item)) {
        handler = handleRow;
      } else {
        throw new TypeError(
          `Unsupported input type for toLazyRowBinary: expected Row, Row[], LazyRow, or LazyRow[], got ${typeof item}`,
        );
      }

      return handler(item);
    };

    for await (const item of data) {
      yield handler(item);
    }
  };
}

/**
 * Parse binary lazyrow format into LazyRow batches.
 *
 * @example Read binary lazyrow file
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromLazyRowBinary } from "jsr:@j50n/proc/transforms";
 *
 * await read("data.lazyrow")
 *   .transform(fromLazyRowBinary())
 *   .flatten()
 *   .filter(row => row.getField(0) === "active")
 *   .forEach(row => console.log(row.getField(1)));
 * ```
 */
export function fromLazyRowBinary() {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<LazyRow[]> {
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    let buffer: Uint8Array | null = null;
    let offset = 0;
    let currentBatch: LazyRow[] = [];
    let currentBatchSize = 0;

    const ensureBuffer = () => {
      if (buffer && offset === 0) return;
      buffer = new Uint8Array(totalLen - offset);
      let pos = 0;
      let skip = offset;
      for (const chunk of chunks) {
        if (skip >= chunk.length) {
          skip -= chunk.length;
          continue;
        }
        const src = skip > 0 ? chunk.subarray(skip) : chunk;
        skip = 0;
        buffer.set(src, pos);
        pos += src.length;
      }
      chunks.length = 0;
      chunks.push(buffer);
      totalLen = buffer.length;
      offset = 0;
    };

    for await (const chunk of bytes) {
      chunks.push(chunk);
      totalLen += chunk.length;
      buffer = null;

      ensureBuffer();

      while (totalLen - offset >= 4) {
        const view = new DataView(buffer!.buffer, buffer!.byteOffset + offset);
        const rowLength = view.getUint32(0, true);

        if (totalLen - offset < 4 + rowLength) break;

        const rowData = buffer!.subarray(offset + 4, offset + 4 + rowLength);
        currentBatch.push(LazyRow.fromBinary(rowData));
        currentBatchSize += rowLength;
        offset += 4 + rowLength;

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
  };
}
