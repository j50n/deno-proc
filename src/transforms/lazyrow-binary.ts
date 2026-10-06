import type { TransformerFunction } from "../transformers.ts";
import {
  asRows,
  BATCH_SIZE_BYTES,
  frameBinaryRows,
  toBinaryRow,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { concat } from "../utility.ts";

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
export function toLazyRowBinary(): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array
> {
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    for await (const item of data) {
      yield frameBinaryRows(asRows(item).map(toBinaryRow));
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
export function fromLazyRowBinary(): TransformerFunction<
  Uint8Array,
  LazyRow[]
> {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<LazyRow[]> {
    let buffer: Uint8Array = new Uint8Array(0);
    let pending: Uint8Array[] = [];
    let available = 0;
    // Bytes needed before the next row can be read: its length prefix, then
    // the whole row. Chunks wait in `pending` until there are enough, so a
    // large row is copied once rather than once per chunk.
    let needed = 4;
    let currentBatch: LazyRow[] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      pending.push(chunk);
      available += chunk.length;
      if (available < needed) continue;

      buffer = concat([buffer, ...pending]);
      pending = [];
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );

      let offset = 0;
      while (true) {
        if (buffer.length - offset < 4) {
          needed = 4;
          break;
        }
        const rowLength = view.getUint32(offset, true);
        if (buffer.length - offset < 4 + rowLength) {
          needed = 4 + rowLength;
          break;
        }

        const rowData = buffer.subarray(offset + 4, offset + 4 + rowLength);
        currentBatch.push(LazyRow.fromBinary(rowData));
        currentBatchSize += rowLength;
        offset += 4 + rowLength;

        if (currentBatchSize >= BATCH_SIZE_BYTES) {
          yield currentBatch;
          currentBatch = [];
          currentBatchSize = 0;
        }
      }

      buffer = buffer.subarray(offset);
      available = buffer.length;
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
    if (available > 0) {
      throw new Error(
        `LazyRow binary data ends partway through a row (${available} bytes left over)`,
      );
    }
  };
}
