import type { TransformerFunction } from "../transformers.ts";
import { readRows } from "../wasm/flatdata.ts";
import { batchRows, checkFields, rowWriter } from "./common.ts";
import { type LazyRow, lazyRows } from "./lazy-row.ts";
import type { Row } from "./types.ts";

const TAB = 0x09;
const TSV_FORBIDDEN = /[\t\n\r]/;

/**
 * Parse TSV bytes into batches of string arrays.
 *
 * Each line is a row and tabs separate its fields. TSV has no quoting and
 * can't hold a tab, LF or CR in a field: every CR is dropped, so CRLF files
 * read like LF files, and blank lines are skipped. A UTF-8 byte order mark
 * at the start is dropped, and invalid UTF-8 is an error. All rows are data;
 * there is no special header handling.
 *
 * The reader is the WebAssembly CSV reader with quoting off; each batch
 * holds the rows of about 128 KB of input.
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
  return async function* (bytes) {
    for await (const batch of readRows(bytes, TAB, false)) {
      yield batchRows(batch);
    }
  };
}

/**
 * Parse TSV bytes into batches of {@link LazyRow} objects.
 *
 * Reads TSV as {@link fromTsvToRows} does, but leaves each field undecoded
 * until it is read. When a pipeline looks at only a few fields of each row,
 * such as a filter, this is several times faster, especially with
 * {@link LazyRow.fieldEquals}.
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
 *   .filter((row) => row.fieldEquals(2, "ERROR"))
 *   .forEach((row) => console.log(row.getField(0)));
 * ```
 *
 * @returns A transformer function for use with `.transform()`.
 */
export function fromTsvToLazyRows(): TransformerFunction<
  Uint8Array,
  LazyRow[]
> {
  return async function* (bytes) {
    for await (const batch of readRows(bytes, TAB, false)) {
      yield lazyRows(batch);
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
export function toTsv(): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array
> {
  return rowWriter((fields, rowNumber) => {
    checkFields(fields, TSV_FORBIDDEN, "TSV", rowNumber);
    let line = "";
    for (let i = 0; i < fields.length; i++) {
      if (i > 0) line += "\t";
      line += fields[i];
    }
    return line + "\n";
  });
}
