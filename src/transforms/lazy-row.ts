import type { RowBatch } from "../wasm/flatdata.ts";

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const encoder = new TextEncoder();

/**
 * A row whose fields are decoded only when they are read.
 *
 * Rows from `fromCsvToLazyRows` and `fromTsvToLazyRows` are views of the
 * bytes the reader produced: reading a field decodes just that field, and
 * {@link LazyRow.fieldEquals} compares bytes without making a string at all,
 * which makes it the fastest way to filter rows. Rows from record format and
 * {@link LazyRow.fromStringArray} wrap strings; they work wherever a LazyRow
 * is accepted.
 *
 * A LazyRow can't be changed. To change a row, take
 * {@link LazyRow.toStringArray} and work on that.
 *
 * A row read from CSV or TSV keeps the bytes of its whole batch (about
 * 128 KB of input) alive. To hold on to a few rows out of a large stream,
 * keep their `toStringArray()` instead.
 *
 * @example Create from string array
 * ```typescript
 * import { LazyRow } from "jsr:@j50n/proc/transforms";
 *
 * const row = LazyRow.fromStringArray(["Alice", "30", "Engineer"]);
 * console.log(row.getField(0)); // "Alice"
 * console.log(row.columnCount); // 3
 * ```
 *
 * @example Filter on one field, read another
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToLazyRows } from "jsr:@j50n/proc/transforms";
 *
 * await read("users.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.fieldEquals(2, "active"))
 *   .map((row) => row.getField(0))
 *   .forEach((name) => console.log(name));
 * ```
 */
export abstract class LazyRow {
  /** Number of fields in this row. */
  abstract readonly columnCount: number;

  /**
   * Get a field by index.
   * @param index Zero-based field index.
   * @returns The field value as a string.
   * @throws RangeError if index is out of bounds.
   */
  abstract getField(index: number): string;

  /**
   * Whether a field holds exactly `value`. For rows read from CSV or TSV this
   * compares bytes and makes no string, so it is much faster than
   * `getField(index) === value`.
   * @param index Zero-based field index.
   * @param value The value to compare with.
   * @throws RangeError if index is out of bounds.
   */
  abstract fieldEquals(index: number, value: string): boolean;

  /**
   * Convert to a string array.
   * @returns All fields as a new string array.
   */
  abstract toStringArray(): string[];

  /**
   * Create a LazyRow from a string array.
   *
   * @param fields Array of field values. The row keeps this array.
   * @returns A LazyRow wrapping the fields.
   */
  static fromStringArray(fields: string[]): LazyRow {
    return new StringArrayRow(fields);
  }

  protected checkIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.columnCount) {
      throw new RangeError(
        `Field index ${index} out of range [0, ${this.columnCount})`,
      );
    }
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
    this.checkIndex(index);
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
    this.checkIndex(index);
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
    this.checkIndex(index);
    const expected = encoded(value);
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
let lastEncoded = new Uint8Array(0);

function encoded(value: string): Uint8Array {
  if (value !== lastValue) {
    lastEncoded = encoder.encode(value);
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
