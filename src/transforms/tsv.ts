import { BATCH_SIZE_BYTES } from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

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
      buffer += decoder.decode(chunk, { stream: true });

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

    buffer += decoder.decode();
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
      buffer += decoder.decode(chunk, { stream: true });

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

    buffer += decoder.decode();
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

    for await (const item of data) {
      if (Array.isArray(item)) {
        if (item.length === 0) continue;

        const first = item[0];

        if (Array.isArray(first)) {
          // Row[]
          const lines = (item as Row[]).map((row) => {
            rowNumber++;
            validateTsvFields(row, rowNumber);
            return row.join("\t");
          });
          yield encoder.encode(lines.join("\n") + "\n");
        } else if (first instanceof LazyRow) {
          // LazyRow[]
          const lines = (item as LazyRow[]).map((row) => {
            rowNumber++;
            const fields = row.toStringArray();
            validateTsvFields(fields, rowNumber);
            return fields.join("\t");
          });
          yield encoder.encode(lines.join("\n") + "\n");
        } else {
          // Row (single string[])
          rowNumber++;
          validateTsvFields(item as Row, rowNumber);
          yield encoder.encode((item as Row).join("\t") + "\n");
        }
      } else if (item instanceof LazyRow) {
        // Single LazyRow
        rowNumber++;
        const fields = item.toStringArray();
        validateTsvFields(fields, rowNumber);
        yield encoder.encode(fields.join("\t") + "\n");
      }
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
