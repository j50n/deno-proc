// Decoding the reader's batches, with errors that say where.

import type { RowBatch } from "../wasm/flatdata.ts";

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** The longest string V8 can make, in UTF-16 code units. */
const MAX_STRING_LENGTH = 2 ** 29 - 24;

const RS = 0x1E;

/**
 * The whole batch decoded in one call: much faster than field by field when
 * every field is wanted. Invalid UTF-8 throws a `TypeError` naming the first
 * bad field's row and field; a batch longer than a string can be throws a
 * `RangeError`.
 */
export function decodeBatch(batch: RowBatch): string {
  const ends = batch.textEnds;
  if (ends.length > 0 && ends[ends.length - 1] + 1 > MAX_STRING_LENGTH) {
    throw new RangeError(
      `Rows too long for a JavaScript string in ${batch.format} data at row ${batch.firstRow}; ` +
        "read single fields with lazy rows and getField(), or convert bytes " +
        "to bytes with csvToTsv() or tsvToCsv()",
    );
  }
  try {
    return decoder.decode(batch.bytes);
  } catch (cause) {
    throw invalidUtf8(batch, 0, cause);
  }
}

/** The batch's field `j` (counted over the whole batch) decoded alone. */
export function decodeField(batch: RowBatch, j: number): string {
  const { bytes, byteEnds, textEnds } = batch;
  if (textEnds[j] - (j === 0 ? 0 : textEnds[j - 1] + 1) > MAX_STRING_LENGTH) {
    throw new RangeError(
      `Field too long for a JavaScript string in ${batch.format} data`,
    );
  }
  try {
    return decoder.decode(
      bytes.subarray(j === 0 ? 0 : byteEnds[j - 1] + 1, byteEnds[j]),
    );
  } catch (cause) {
    throw invalidUtf8(batch, j, cause);
  }
}

/**
 * The `TypeError` for the first field from `from` on that isn't valid UTF-8,
 * naming its row and field as the parsers' other errors do. Only an error
 * pays for decoding field by field.
 */
function invalidUtf8(batch: RowBatch, from: number, cause: unknown) {
  const { bytes, byteEnds } = batch;
  let row = batch.firstRow, field = 1;
  for (let j = 0; j < byteEnds.length; j++) {
    if (j >= from) {
      try {
        decoder.decode(
          bytes.subarray(j === 0 ? 0 : byteEnds[j - 1] + 1, byteEnds[j]),
        );
      } catch {
        return new TypeError(
          `Invalid UTF-8 in ${batch.format} data at row ${row}, field ${field}`,
          { cause },
        );
      }
    }
    if (bytes[byteEnds[j]] === RS) {
      row += 1;
      field = 1;
    } else {
      field += 1;
    }
  }
  return new TypeError(
    `Invalid UTF-8 in ${batch.format} data from row ${batch.firstRow}`,
    { cause },
  );
}
