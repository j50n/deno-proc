import type { TransformerFunction } from "../transformers.ts";
import {
  BATCH_SIZE_BYTES,
  checkFields,
  checkNoLeadingBom,
  FIELD_SEPARATOR,
  RECORD_SEPARATOR,
  rowWriter,
} from "./common.ts";
import { splitText } from "../split-text.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";

const RECORD_FORBIDDEN = new RegExp(`[${RECORD_SEPARATOR}${FIELD_SEPARATOR}]`);

/** Batch the parsed records of a record-format stream. */
async function* recordBatches<T>(
  bytes: AsyncIterable<Uint8Array>,
  toRow: (fields: string[]) => T,
): AsyncIterable<T[]> {
  let currentBatch: T[] = [];
  let currentBatchSize = 0;

  for await (
    const records of splitText(
      bytes,
      RECORD_SEPARATOR,
      (row) => `Invalid UTF-8 in record data at row ${row}`,
    )
  ) {
    for (const record of records) {
      currentBatch.push(toRow(record.split(FIELD_SEPARATOR)));
      currentBatchSize += record.length;

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
 * Parse the record format into batches of rows, each row a `string[]`.
 *
 * The input is split into records on {@link RECORD_SEPARATOR} (`\x1E`) and
 * each record into fields on {@link FIELD_SEPARATOR} (`\x1F`). Nothing else is
 * special: tabs, quotes, and newlines are field text. Text after the last
 * `\x1E` is a final record. Every piece between separators is a record, so an
 * empty one reads as `[""]`, and a newline after the last `\x1E` (as `echo`
 * adds) reads as a row `["\n"]`. Batches close at about 128 KiB of text
 * ({@link BATCH_SIZE_BYTES}); add `.flatten()` to work row by row.
 *
 * A UTF-8 byte order mark at the start is dropped. Invalid UTF-8 throws a
 * `TypeError`.
 *
 * @example Read rows another program wrote
 * ```ts
 * import { run } from "@j50n/proc";
 * import { fromRecordToRows } from "@j50n/proc/transforms";
 *
 * const rows = await run("./export-users")
 *   .transform(fromRecordToRows())
 *   .flatten()
 *   .collect();
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function fromRecordToRows(): TransformerFunction<Uint8Array, Row[]> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<Row[]> =>
    recordBatches(bytes, (fields) => fields);
}

/**
 * Parse the record format into batches of {@link LazyRow}s.
 *
 * Parsing is the same as in {@link fromRecordToRows}. The rows are
 * string-backed: each record is decoded and split as it is read, so this is no
 * faster than {@link fromRecordToRows}. Use it when the code downstream takes
 * `LazyRow`s.
 *
 * @example
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromRecordToLazyRows } from "@j50n/proc/transforms";
 *
 * await read("data.rec")
 *   .transform(fromRecordToLazyRows())
 *   .flatten()
 *   .filter((row) => row.getField(0) === "active")
 *   .forEach((row) => console.log(row.getField(1)));
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function fromRecordToLazyRows(): TransformerFunction<
  Uint8Array,
  LazyRow[]
> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> =>
    recordBatches(bytes, LazyRow.fromStringArray);
}

/**
 * Write rows in the record format: fields joined by {@link FIELD_SEPARATOR}
 * (`\x1F`), each row ended by {@link RECORD_SEPARATOR} (`\x1E`).
 *
 * A field can hold any text but those two characters. One that holds either
 * throws an `Error` naming the row and field, counted from 1:
 * `Invalid character (field separator) in record data at row 2, field 2`.
 * A row with no fields (a `[]` inside a batch) throws too, since it would be
 * written as `\x1E` and read back as `[""]`:
 * `Invalid row (no fields) in record data at row 3`. So do a lone surrogate,
 * which UTF-8 can't hold, and a first field starting with U+FEFF, which the
 * reader would drop as a byte order mark. A row `[""]` is written as `\x1E`
 * and reads back as itself. Items before the one that throws have already
 * been written.
 *
 * Each item is a row or a batch of rows, as {@link Row}s or {@link LazyRow}s,
 * and may differ from the one before. Each yields one chunk of bytes; an
 * item `[]` is an empty batch.
 *
 * @example Hand CSV to a program as records
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows, toRecord } from "@j50n/proc/transforms";
 *
 * const report = await read("data.csv")
 *   .transform(fromCsvToRows())
 *   .transform(toRecord())
 *   .run("./summarize")
 *   .lines
 *   .collect();
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function toRecord(): TransformerFunction<
  Row | Row[] | LazyRow | LazyRow[],
  Uint8Array<ArrayBuffer>
> {
  return rowWriter("record", (fields, rowNumber) => {
    checkFields(fields, RECORD_FORBIDDEN, "record", rowNumber);
    checkNoLeadingBom(fields, "record", rowNumber);
    return fields.join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
  });
}
