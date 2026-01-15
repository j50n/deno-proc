import { BATCH_SIZE_BYTES } from "./common.ts";
import { LazyRow } from "./lazy-row.ts";

type Row = Record<string, string>;

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

/**
 * Parse TSV bytes into batches of row objects.
 *
 * Streams TSV data efficiently, yielding batches of parsed rows (~128KB each).
 * The first line is treated as headers, and subsequent rows become objects
 * with header names as keys.
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
 * // Record<string, string>[] - objects with header keys
 * ```
 *
 * @example Filter by field
 * ```typescript
 * await read("users.tsv")
 *   .transform(fromTsvToRows())
 *   .flatten()
 *   .filter(row => row.status === "active")
 *   .forEach(row => console.log(row.name));
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
    let headers: string[] | null = null;

    for await (const chunk of bytes) {
      buffer += decoder.decode(chunk, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        const fields = line.split("\t");

        if (headers === null) {
          headers = fields;
          continue;
        }

        const row: Row = {};
        for (let i = 0; i < headers.length; i++) {
          row[headers[i]] = fields[i] || "";
        }

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
      if (headers === null) {
        headers = fields;
      } else {
        const row: Row = {};
        for (let i = 0; i < headers.length; i++) {
          row[headers[i]] = fields[i] || "";
        }
        currentBatch.push(row);
      }
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
    data: AsyncIterable<Row[] | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    let rowNumber = 0;

    for await (const batch of data) {
      if (batch.length === 0) continue;

      let lines: string[];

      if (batch[0] instanceof LazyRow) {
        const lazyRows = batch as LazyRow[];
        lines = lazyRows.map((row) => {
          rowNumber++;
          const fields = row.toStringArray();
          validateTsvFields(fields, rowNumber);
          return fields.join("\t");
        });
      } else {
        const rows = batch as Row[];
        lines = rows.map((row) => {
          rowNumber++;
          const fields = Object.values(row);
          validateTsvFields(fields, rowNumber);
          return fields.join("\t");
        });
      }

      const tsv = lines.join("\n") + "\n";
      yield encoder.encode(tsv);
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
