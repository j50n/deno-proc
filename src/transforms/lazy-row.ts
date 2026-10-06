import type { RowBatch } from "../wasm/flatdata.ts";

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const encoder = new TextEncoder();

/**
 * A row whose fields are decoded only when you read them.
 *
 * Rows from {@link fromCsvToLazyRows} and {@link fromTsvToLazyRows} are views
 * of the bytes the parser produced. `getField` decodes just that field, and
 * {@link LazyRow.fieldEquals} compares bytes without making a string, which
 * makes it the fastest way to filter rows. Rows from the record parsers and
 * {@link LazyRow.fromStringArray} wrap a `string[]`. Every writer (`toCsv`,
 * `toTsv`, `toRecord`) takes either kind.
 *
 * A LazyRow can't be changed. To change a row, take
 * {@link LazyRow.toStringArray} and work on that.
 *
 * A row read from CSV or TSV keeps the bytes of its whole batch (the rows of
 * about 128 KiB of input) alive. To hold on to a few rows out of a large
 * stream, keep their `toStringArray()` instead.
 *
 * @example Wrap fields
 * ```ts
 * import { LazyRow } from "@j50n/proc/transforms";
 *
 * const row = LazyRow.fromStringArray(["Alice", "30", "Engineer"]);
 * row.getField(0); // "Alice"
 * row.columnCount; // 3
 * ```
 *
 * @example Filter on one field, read another
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToLazyRows } from "@j50n/proc/transforms";
 *
 * const names = await read("users.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.fieldEquals(2, "active"))
 *   .map((row) => row.getField(0))
 *   .collect();
 * ```
 */
export abstract class LazyRow {
  /** The number of fields. */
  abstract readonly columnCount: number;

  /**
   * The field at `index`, counted from 0.
   *
   * @throws {RangeError} If `index` is outside `[0, columnCount)`.
   * @throws {TypeError} If the field's bytes are not valid UTF-8 (rows read
   *   from CSV or TSV only).
   */
  abstract getField(index: number): string;

  /**
   * Whether the field at `index` is exactly `value`. On a row read from CSV
   * or TSV this compares the field's bytes with `value` encoded as UTF-8 and
   * makes no string, so it is much faster than `getField(index) === value`.
   *
   * @throws {RangeError} If `index` is outside `[0, columnCount)`.
   */
  abstract fieldEquals(index: number, value: string): boolean;

  /**
   * All fields, as a new array.
   *
   * @throws {TypeError} On a row read from CSV or TSV, if any row of its
   *   batch holds invalid UTF-8: the batch is decoded in one call.
   */
  abstract toStringArray(): string[];

  /** Wrap `fields` as a LazyRow. The array is not copied. */
  static fromStringArray(fields: string[]): LazyRow {
    return new StringArrayRow(fields);
  }
}

/** Throws the `RangeError` for an index outside `[0, columnCount)`. */
function checkIndex(row: LazyRow, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= row.columnCount) {
    throw new RangeError(
      `Field index ${index} out of range [0, ${row.columnCount})`,
    );
  }
}

class StringArrayRow extends LazyRow {
  constructor(private readonly fields: string[]) {
    super();
  }

  get columnCount(): number {
    return this.fields.length;
  }

  getField(index: number): string {
    checkIndex(this, index);
    return this.fields[index];
  }

  fieldEquals(index: number, value: string): boolean {
    return this.getField(index) === value;
  }

  toStringArray(): string[] {
    return [...this.fields];
  }
}

/**
 * The rows of one batch from the reader, copied out of WASM memory so they
 * outlive the next read. Its rows share it.
 */
class OwnedBatch {
  readonly bytes: Uint8Array;
  readonly byteEnds: Uint32Array;
  readonly textEnds: Uint32Array;
  /**
   * The whole batch decoded, once a row is asked for all its fields.
   * Decoding once and slicing is the fast way to get every field; decoding
   * fields one by one is the fast way to get a few.
   */
  text?: string;

  constructor(batch: RowBatch) {
    this.bytes = batch.bytes.slice();
    this.byteEnds = batch.byteEnds.slice();
    this.textEnds = batch.textEnds.slice();
  }

  decodeAll(): string {
    return this.text ??= decoder.decode(this.bytes);
  }
}

class BatchRow extends LazyRow {
  constructor(
    private readonly batch: OwnedBatch,
    /** Index of the row's first field among the batch's fields. */
    private readonly first: number,
    readonly columnCount: number,
  ) {
    super();
  }

  getField(index: number): string {
    checkIndex(this, index);
    const j = this.first + index;
    const { text, textEnds, bytes, byteEnds } = this.batch;
    if (text !== undefined) {
      return text.slice(j === 0 ? 0 : textEnds[j - 1] + 1, textEnds[j]);
    }
    return decoder.decode(
      bytes.subarray(j === 0 ? 0 : byteEnds[j - 1] + 1, byteEnds[j]),
    );
  }

  fieldEquals(index: number, value: string): boolean {
    checkIndex(this, index);
    const expected = encoded(value);
    if (expected === undefined) return false;
    const j = this.first + index;
    const { bytes, byteEnds } = this.batch;
    const start = j === 0 ? 0 : byteEnds[j - 1] + 1;
    if (byteEnds[j] - start !== expected.length) return false;
    for (let k = 0; k < expected.length; k++) {
      if (bytes[start + k] !== expected[k]) return false;
    }
    return true;
  }

  toStringArray(): string[] {
    const text = this.batch.decodeAll();
    const ends = this.batch.textEnds;
    const fields = new Array<string>(this.columnCount);
    let start = this.first === 0 ? 0 : ends[this.first - 1] + 1;
    for (let i = 0; i < fields.length; i++) {
      const end = ends[this.first + i];
      fields[i] = text.slice(start, end);
      start = end + 1;
    }
    return fields;
  }
}

/** The last value `fieldEquals` encoded: a filter compares the same one. */
let lastValue = "";
let lastEncoded: Uint8Array | undefined = new Uint8Array(0);

/**
 * `value` as UTF-8, or `undefined` if it holds a lone surrogate. Encoding
 * would make that U+FFFD, and a field holding a real U+FFFD would match it;
 * no field decoded from UTF-8 holds a lone surrogate, so none equals it.
 */
function encoded(value: string): Uint8Array | undefined {
  if (value !== lastValue) {
    lastEncoded = value.isWellFormed() ? encoder.encode(value) : undefined;
    lastValue = value;
  }
  return lastEncoded;
}

const RS = 0x1E;

/** The rows of a batch from the reader, as LazyRows. */
export function lazyRows(batch: RowBatch): LazyRow[] {
  const owned = new OwnedBatch(batch);
  const { bytes, byteEnds } = owned;
  const rows: LazyRow[] = [];
  let first = 0;
  for (let j = 0; j < byteEnds.length; j++) {
    if (bytes[byteEnds[j]] === RS) {
      rows.push(new BatchRow(owned, first, j - first + 1));
      first = j + 1;
    }
  }
  return rows;
}
