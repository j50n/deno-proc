import { BATCH_SIZE_BYTES, joinRow, joinRows } from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import { concat } from "../utility.ts";
import { writeUint32LE } from "./common.ts";

const decode = (() => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return decoder.decode.bind(decoder);
})();

/**
 * Parse TSV bytes into batches of string arrays.
 *
 * Streams TSV data efficiently, yielding batches of parsed rows (~128KB each).
 * All rows are treated as data - no special header handling.
 *
 * **Performance**: TSV parsing is faster than CSV (72 MB/s vs 27 MB/s) because
 * it doesn't need to handle quoted fields or escaped characters.
 *
 * @example Basic TSV parsing
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromTsvToRows } from "jsr:@j50n/proc/transforms";
 *
 * const rows = await read("data.tsv")
 *   .transform(fromTsvToRows())
 *   .flatten()
 *   .collect();
 * // string[][] - arrays of field values
 * ```
 *
 * @example Filter by field
 * ```typescript
 * await read("users.tsv")
 *   .transform(fromTsvToRows())
 *   .flatten()
 *   .filter(row => row[2] === "active")
 *   .forEach(row => console.log(row[0]));
 * ```
 *
 * @returns A transformer function for use with `.transform()`.
 */
export function fromTsvToRows() {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<Row[]> {
    let buffer = "";
    let currentBatch: Row[] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decode(chunk, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const fields = line.split("\t");
        currentBatch.push(fields);
        currentBatchSize += line.length;

        if (currentBatchSize >= BATCH_SIZE_BYTES) {
          yield currentBatch;
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
    }

    buffer += decode();
    if (buffer.trim()) {
      const fields = buffer.split("\t");
      currentBatch.push(fields);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

/**
 * Parse TSV bytes into batches of LazyRow objects.
 *
 * Like {@link fromTsvToRows} but returns {@link LazyRow} objects for better
 * performance when accessing fields by index. Does not parse headers.
 *
 * @example Efficient field access by index
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromTsvToLazyRows } from "jsr:@j50n/proc/transforms";
 *
 * await read("large.tsv")
 *   .transform(fromTsvToLazyRows())
 *   .flatten()
 *   .drop(1) // Skip header row
 *   .filter(row => row.getField(2) === "ERROR")
 *   .forEach(row => console.log(row.getField(0)));
 * ```
 *
 * @returns A transformer function for use with `.transform()`.
 */
export function fromTsvToLazyRows() {
  return async function* (
    bytes: AsyncIterable<Uint8Array>,
  ): AsyncIterable<LazyRow[]> {
    let buffer = "";
    let currentBatch: LazyRow[] = [];
    let currentBatchSize = 0;

    for await (const chunk of bytes) {
      buffer += decode(chunk, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const fields = line.split("\t");
        const row = LazyRow.fromStringArray(fields);

        currentBatch.push(row);
        currentBatchSize += line.length;

        if (currentBatchSize >= BATCH_SIZE_BYTES) {
          yield currentBatch;
          currentBatch = [];
          currentBatchSize = 0;
        }
      }
    }

    buffer += decode();
    if (buffer.trim()) {
      const fields = buffer.split("\t");
      const row = LazyRow.fromStringArray(fields);
      currentBatch.push(row);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  };
}

/**
 * Convert row data to TSV bytes.
 *
 * Accepts batches of row objects or LazyRow objects. Produces tab-separated
 * output without headers (caller should add headers if needed).
 *
 * **Important**: TSV format does not support data containing tab (`\t`),
 * carriage return (`\r`), or line feed (`\n`) characters. This function
 * validates input and throws an error if invalid characters are found.
 *
 * @example Write TSV file
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromTsvToRows, toTsv } from "jsr:@j50n/proc/transforms";
 *
 * await read("input.tsv")
 *   .transform(fromTsvToRows())
 *   .transform(toTsv())
 *   .writeTo("output.tsv");
 * ```
 *
 * @throws {Error} If data contains tab, CR, or LF characters
 * @returns A transformer function for use with `.transform()`.
 */
export function toTsv() {
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    let rowNumber = 0;
    const encode = (() => {
      const encoder = new TextEncoder();
      return encoder.encode.bind(encoder);
    })();
    const processor = await FlatdataProcessor.create();

    const handleRow = (row: Row): Uint8Array => {
      rowNumber++;
      validateTsvFields(row, rowNumber);
      return encode(joinRow(row, "\t", "\n"));
    };

    const handleRowArray = (rows: Row[]): Uint8Array => {
      for (const row of rows) {
        rowNumber++;
        validateTsvFields(row, rowNumber);
      }
      return encode(joinRows(rows, "\t", "\n"));
    };

    const handleBinaryLazyRow = (row: LazyRow): Uint8Array => {
      rowNumber++;
      const rowData = row.toBinary();
      return processor.lazyRowBinaryToTsvDirect(
        concat([writeUint32LE(rowData.length), rowData]),
      );
    };

    const handleStringLazyRow = (row: LazyRow): Uint8Array => {
      rowNumber++;
      const fields = row.toStringArray();
      validateTsvFields(fields, rowNumber);
      return encode(joinRow(fields, "\t", "\n"));
    };

    const handleBinaryLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const chunks = new Array(rows.length * 2);
      let idx = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i].toBinary();
        chunks[idx++] = writeUint32LE(rowData.length);
        chunks[idx++] = rowData;
      }

      rowNumber += rows.length;
      return processor.lazyRowBinaryToTsvDirect(concat(chunks));
    };

    const handleStringLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const stringRows: Row[] = [];
      for (const row of rows) {
        rowNumber++;
        const fields = row.toStringArray();
        validateTsvFields(fields, rowNumber);
        stringRows.push(fields);
      }
      return encode(joinRows(stringRows, "\t", "\n"));
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
          `Unsupported input type for toTsv: expected Row, Row[], LazyRow, or LazyRow[], got ${typeof item}`,
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
 * Validate that fields don't contain invalid TSV characters.
 * @throws {Error} If any field contains tab, CR, or LF
 */
function validateTsvFields(fields: string[], rowNumber: number): void {
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.includes("\t")) {
      throw new Error(
        `Invalid character (tab) in TSV data at row ${rowNumber.toLocaleString()}, field ${
          i + 1
        }`,
      );
    }
    if (field.includes("\r")) {
      throw new Error(
        `Invalid character (CR) in TSV data at row ${rowNumber.toLocaleString()}, field ${
          i + 1
        }`,
      );
    }
    if (field.includes("\n")) {
      throw new Error(
        `Invalid character (LF) in TSV data at row ${rowNumber.toLocaleString()}, field ${
          i + 1
        }`,
      );
    }
  }
}
