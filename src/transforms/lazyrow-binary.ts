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
 * Write rows in the LazyRow binary format, which can hold any string in a
 * field.
 *
 * Each row is a little-endian u32 byte length, then the row in the layout of
 * {@link LazyRow.toBinary}: a u32 field count, a u32 byte length per field,
 * and the fields' UTF-8 bytes. The length counts the bytes after itself.
 * {@link fromLazyRowBinary} reads it back as binary-backed {@link LazyRow}s.
 * Use it to store or pass rows between proc programs without quoting or
 * re-parsing.
 *
 * Each item is a row or a batch of rows, as {@link Row}s or {@link LazyRow}s,
 * and may differ from the one before. Each yields one chunk of bytes. No field
 * is refused.
 *
 * @example Store a CSV file's rows
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToLazyRows, toLazyRowBinary } from "@j50n/proc/transforms";
 *
 * await read("data.csv")
 *   .transform(fromCsvToLazyRows())
 *   .transform(toLazyRowBinary())
 *   .writeTo("data.lazyrow");
 * ```
 *
 * @returns A transformer for `.transform()`.
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
 * Parse the LazyRow binary format written by {@link toLazyRowBinary} into
 * batches of binary-backed {@link LazyRow}s.
 *
 * Fields are decoded only when read. Batches close at about 128 KiB
 * ({@link BATCH_SIZE_BYTES}); add `.flatten()` to work row by row. Only the
 * length prefixes are checked: input that ends partway through a row throws an
 * `Error` after the complete rows have been yielded.
 *
 * @example
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromLazyRowBinary } from "@j50n/proc/transforms";
 *
 * await read("data.lazyrow")
 *   .transform(fromLazyRowBinary())
 *   .flatten()
 *   .filter((row) => row.getField(0) === "active")
 *   .forEach((row) => console.log(row.getField(1)));
 * ```
 *
 * @returns A transformer for `.transform()`.
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
