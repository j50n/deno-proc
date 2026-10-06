import type { TransformerFunction } from "../transformers.ts";
import {
  BATCH_SIZE_BYTES,
  checkBinaryFields,
  checkFields,
  FIELD_SEPARATOR,
  forbiddenBytes,
  isBinaryLazyRowArray,
  isRow,
  isRowArray,
  isStringLazyRowArray,
  RECORD_SEPARATOR,
  rowsToRecord,
  rowToRecord,
  splitText,
  writeUint32LE,
} from "./common.ts";
import { LazyRow } from "./lazy-row.ts";
import type { Row } from "./types.ts";
import { FlatdataProcessor } from "../wasm/flatdata-processor.ts";
import { concat } from "../utility.ts";

const RECORD_FORBIDDEN = forbiddenBytes({
  0x1E: "record separator",
  0x1F: "field separator",
});

/** Batch the parsed records of a record-format stream. */
async function* recordBatches<T>(
  bytes: AsyncIterable<Uint8Array>,
  toRow: (fields: string[]) => T,
): AsyncIterable<T[]> {
  let currentBatch: T[] = [];
  let currentBatchSize = 0;

  for await (const records of splitText(bytes, RECORD_SEPARATOR)) {
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
 * Invalid UTF-8 throws a `TypeError`.
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
 * Items before the one holding it have already been written.
 *
 * Each item is a row or a batch of rows, as {@link Row}s or {@link LazyRow}s,
 * and yields one chunk of bytes.
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
  Uint8Array
> {
  return async function* (
    data: AsyncIterable<Row | Row[] | LazyRow | LazyRow[]>,
  ): AsyncIterable<Uint8Array> {
    const encode = (() => {
      const encoder = new TextEncoder();
      return encoder.encode.bind(encoder);
    })();
    const processor = await FlatdataProcessor.create();
    let rowNumber = 0;

    const check = (fields: string[]) =>
      checkFields(fields, RECORD_FORBIDDEN, "record", ++rowNumber);
    const checkBinary = (rowData: Uint8Array) =>
      checkBinaryFields(rowData, RECORD_FORBIDDEN, "record", ++rowNumber);

    const handleRow = (row: Row): Uint8Array => {
      check(row);
      return encode(rowToRecord(row));
    };

    const handleRowArray = (rows: Row[]): Uint8Array => {
      rows.forEach(check);
      return encode(rowsToRecord(rows));
    };

    const handleBinaryLazyRow = (row: LazyRow): Uint8Array => {
      const rowData = row.toBinary();
      checkBinary(rowData);
      return processor.lazyRowBinaryToRecordDirect(
        concat([writeUint32LE(rowData.length), rowData]),
      );
    };

    const handleStringLazyRow = (row: LazyRow): Uint8Array => {
      const fields = row.toStringArray();
      check(fields);
      return encode(rowToRecord(fields));
    };

    const handleBinaryLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const chunks = new Array(rows.length * 2);
      let idx = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowData = rows[i].toBinary();
        checkBinary(rowData);
        chunks[idx++] = writeUint32LE(rowData.length);
        chunks[idx++] = rowData;
      }

      return processor.lazyRowBinaryToRecordDirect(concat(chunks));
    };

    const handleStringLazyRowArray = (rows: LazyRow[]): Uint8Array => {
      const stringRows = rows.map((row) => row.toStringArray());
      stringRows.forEach(check);
      return encode(rowsToRecord(stringRows));
    };

    // Pick the handler on the first item and keep it while items stay that
    // kind; an item of another kind picks again.
    type Item = Row | Row[] | LazyRow | LazyRow[];
    const setup = (item: Item): Uint8Array => {
      if (Array.isArray(item) && item.length === 0) {
        return new Uint8Array(0);
      }

      if (isBinaryLazyRowArray(item)) {
        handler = handleBinaryLazyRowArray as typeof handler;
        accepts = isBinaryLazyRowArray;
      } else if (isStringLazyRowArray(item)) {
        handler = handleStringLazyRowArray as typeof handler;
        accepts = isStringLazyRowArray;
      } else if (item instanceof LazyRow && item.isBinaryBacked()) {
        handler = handleBinaryLazyRow as typeof handler;
        accepts = (it) => it instanceof LazyRow && it.isBinaryBacked();
      } else if (item instanceof LazyRow) {
        handler = handleStringLazyRow as typeof handler;
        accepts = (it) => it instanceof LazyRow && !it.isBinaryBacked();
      } else if (isRowArray(item)) {
        handler = handleRowArray as typeof handler;
        accepts = isRowArray;
      } else if (isRow(item)) {
        handler = handleRow as typeof handler;
        accepts = isRow;
      } else {
        throw new TypeError(
          `Unsupported input type for toRecord: expected Row, Row[], LazyRow, or LazyRow[], got ${typeof item}`,
        );
      }

      return handler(item);
    };

    let handler: (item: Item) => Uint8Array = setup;
    let accepts: (item: Item) => boolean = () => false;

    for await (const item of data) {
      yield accepts(item) ? handler(item) : setup(item);
    }
  };
}
