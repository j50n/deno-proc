import type { TransformerFunction } from "../transformers.ts";
import {
  BATCH_SIZE_BYTES,
  checkBinaryFields,
  checkFields,
  forbiddenBytes,
  isBinaryLazyRowArray,
  isRow,
  isRowArray,
  isStringLazyRowArray,
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
 * Parse TSV into batches of rows, each row a `string[]`.
 *
 * Each line is one row, split on tabs. There is no quoting: quotes are text. A
 * CR before the LF is dropped, so CRLF files read like LF files. Blank lines
 * are skipped, and the last line needs no LF. There is no header handling: the
 * first row is data like the rest. Batches close at about 128 KiB of text
 * ({@link BATCH_SIZE_BYTES}); add `.flatten()` to work row by row.
 *
 * Invalid UTF-8 throws a `TypeError`.
 *
 * @example Print the first field of each row whose third is "active"
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromTsvToRows } from "@j50n/proc/transforms";
 *
 * await read("users.tsv")
 *   .transform(fromTsvToRows())
 *   .flatten()
 *   .filter((row) => row[2] === "active")
 *   .forEach((row) => console.log(row[0]));
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function fromTsvToRows(): TransformerFunction<Uint8Array, Row[]> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<Row[]> =>
    tsvBatches(bytes, (fields) => fields);
}

/**
 * Parse TSV into batches of {@link LazyRow}s.
 *
 * Parsing is the same as in {@link fromTsvToRows}. The rows are string-backed:
 * each line is decoded and split as it is read, so this is no faster than
 * {@link fromTsvToRows}. Use it when the code downstream takes `LazyRow`s.
 *
 * @example
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromTsvToLazyRows } from "@j50n/proc/transforms";
 *
 * await read("log.tsv")
 *   .transform(fromTsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.getField(2) === "ERROR")
 *   .forEach((row) => console.log(row.getField(0)));
 * ```
 *
 * @returns A transformer for `.transform()`.
 */
export function fromTsvToLazyRows(): TransformerFunction<
  Uint8Array,
  LazyRow[]
> {
  return (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> =>
    tsvBatches(bytes, LazyRow.fromStringArray);
}

/**
 * Write rows as TSV: fields joined by tabs, each row ended by LF.
 *
 * TSV has no quoting, so a field can't hold a tab, CR, or LF. One that does
 * throws an `Error` naming the row and field, counted from 1:
 * `Invalid character (tab) in TSV data at row 2, field 1`. Items before the
 * one holding it have already been written. For such data, use {@link toCsv}
 * or {@link toRecord}.
 *
 * Each item is a row or a batch of rows, as {@link Row}s or {@link LazyRow}s,
 * and yields one chunk of bytes.
 *
 * @example Convert CSV to TSV
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows, toTsv } from "@j50n/proc/transforms";
 *
 * await read("data.csv")
 *   .transform(fromCsvToRows())
 *   .transform(toTsv())
 *   .writeTo("data.tsv");
 * ```
 *
 * @returns A transformer for `.transform()`.
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
          `Unsupported input type for toTsv: expected Row, Row[], LazyRow, or LazyRow[], got ${typeof item}`,
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
