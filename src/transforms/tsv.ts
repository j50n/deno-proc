import type { TransformerFunction } from "../transformers.ts";
import {
  BATCH_SIZE_BYTES,
  checkBinaryFields,
  checkFields,
  forbiddenBytes,
  joinRow,
  joinRows,
  splitText,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import { concat } from "../utility.ts";
import { writeUint32LE } from "./common.ts";

const TSV_FORBIDDEN = forbiddenBytes({ 9: "tab", 10: "LF", 13: "CR" });

/**
 * The fields of one TSV line, or `null` for a blank line. A trailing CR is
 * dropped, so CRLF files read the same as LF files; a field can't hold a CR.
 */
function tsvFields(line: string): string[] | null {
  if (line.endsWith("\r")) line = line.slice(0, -1);
  return line === "" ? null : line.split("\t");
}

/** Batch the parsed lines of a TSV stream. */
async function* tsvBatches<T>(
  bytes: AsyncIterable<Uint8Array>,
  toRow: (fields: string[]) => T,
): AsyncIterable<T[]> {
  let currentBatch: T[] = [];
  let currentBatchSize = 0;

  for await (const lines of splitText(bytes, "\n")) {
    for (const line of lines) {
      const fields = tsvFields(line);
      if (fields == null) continue;

      currentBatch.push(toRow(fields));
      currentBatchSize += line.length;

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
export function fromTsvToRows(): TransformerFunction<Uint8Array, Row[]> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<Row[]> =>
    tsvBatches(bytes, (fields) => fields);
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
export function fromTsvToLazyRows(): TransformerFunction<
  Uint8Array,
  LazyRow[]
> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> =>
    tsvBatches(bytes, LazyRow.fromStringArray);
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
export function toTsv(): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array
> {
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
      checkFields(row, TSV_FORBIDDEN, "TSV", rowNumber);
      return encode(joinRow(row, "\t", "\n"));
    };

    const handleRowArray = (rows: Row[]): Uint8Array => {
      for (const row of rows) {
        rowNumber++;
        checkFields(row, TSV_FORBIDDEN, "TSV", rowNumber);
      }
      return encode(joinRows(rows, "\t", "\n"));
    };

    const handleBinaryLazyRow = (row: LazyRow): Uint8Array => {
      rowNumber++;
      const rowData = row.toBinary();
      checkBinaryFields(rowData, TSV_FORBIDDEN, "TSV", rowNumber);
      return processor.lazyRowBinaryToTsvDirect(
        concat([writeUint32LE(rowData.length), rowData]),
      );
    };

    const handleStringLazyRow = (row: LazyRow): Uint8Array => {
      rowNumber++;
      const fields = row.toStringArray();
      checkFields(fields, TSV_FORBIDDEN, "TSV", rowNumber);
      return encode(joinRow(fields, "\t", "\n"));
    };

    const handleBinaryLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const chunks = new Array(rows.length * 2);
      let idx = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i].toBinary();
        checkBinaryFields(rowData, TSV_FORBIDDEN, "TSV", rowNumber + i + 1);
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
        checkFields(fields, TSV_FORBIDDEN, "TSV", rowNumber);
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
