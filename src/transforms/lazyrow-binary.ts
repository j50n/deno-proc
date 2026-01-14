import { BATCH_SIZE_BYTES } from "./common.ts";
import { LazyRow } from "./lazy-row.ts";

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
  const encoder = new TextEncoder();

  return async function* (
    data: AsyncIterable<string[][] | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    for await (const batch of data) {
      if (batch.length === 0) continue;

      const chunks: Uint8Array[] = [];

      for (const item of batch) {
        const fields: Uint8Array[] = item instanceof LazyRow
          ? Array.from(
            { length: item.columnCount },
            (_, i) => encoder.encode(item.getField(i)),
          )
          : (item as string[]).map((f) => encoder.encode(f));

        const fieldCount = fields.length;
        const dataSize = fields.reduce((sum, f) => sum + f.length, 0);
        const headerSize = 4 + fieldCount * 4; // field_count + field_lengths
        const rowLength = headerSize + dataSize;

        const buffer = new Uint8Array(4 + rowLength); // row_length prefix + row
        const view = new DataView(buffer.buffer);

        view.setUint32(0, rowLength, true);
        view.setUint32(4, fieldCount, true);

        let offset = 8 + fieldCount * 4;
        for (let i = 0; i < fieldCount; i++) {
          view.setUint32(8 + i * 4, fields[i].length, true);
          buffer.set(fields[i], offset);
          offset += fields[i].length;
        }

        chunks.push(buffer);
      }

      // Concatenate all row buffers
      const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
      const output = new Uint8Array(totalSize);
      let pos = 0;
      for (const chunk of chunks) {
        output.set(chunk, pos);
        pos += chunk.length;
      }

      yield output;
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
