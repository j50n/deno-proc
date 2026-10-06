const decode = (() => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  return decoder.decode.bind(decoder);
})();
const encode = (() => {
  const encoder = new TextEncoder();
  return encoder.encode.bind(encoder);
})();

/**
 * A row whose fields are decoded only when you read them.
 *
 * A binary-backed LazyRow, from {@link fromCsvToLazyRows},
 * {@link fromLazyRowBinary}, or {@link LazyRow.fromBinary}, holds the row's
 * fields as UTF-8 bytes. `getField` decodes one field and caches it, so a
 * filter that looks at one field of a wide row decodes only that field, and a
 * writer passes an unmodified row on without decoding it. A string-backed
 * LazyRow, from {@link LazyRow.fromStringArray} (and from the TSV and record
 * parsers), wraps a `string[]`.
 *
 * Every writer (`toCsv`, `toTsv`, `toRecord`, `toLazyRowBinary`) takes either
 * kind.
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
 * @example Read one field of each CSV row
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToLazyRows } from "@j50n/proc/transforms";
 *
 * const names = await read("users.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter((row) => row.getField(2) === "active")
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
   * @throws {TypeError} If the field's bytes are not valid UTF-8
   *   (binary-backed rows only).
   */
  abstract getField(index: number): string;

  /**
   * Replace the field at `index`, counted from 0. A string-backed row writes
   * into the array it wraps, so the array given to
   * {@link LazyRow.fromStringArray} changes too.
   *
   * @throws {RangeError} If `index` is outside `[0, columnCount)`.
   */
  abstract setField(index: number, value: string): void;

  /** All fields, as a new array. A binary-backed row decodes every field. */
  abstract toStringArray(): string[];

  /**
   * The row in the binary row layout {@link LazyRow.fromBinary} reads: field
   * count, then each field's byte length, as little-endian u32s, then the
   * fields' UTF-8 bytes. A binary-backed row with no changes returns the bytes
   * it holds, not a copy.
   */
  abstract toBinary(): Uint8Array;

  /** Whether the row holds bytes (`true`) or a `string[]` (`false`). */
  abstract isBinaryBacked(): boolean;

  /**
   * Wrap `fields` as a string-backed LazyRow. The array is not copied.
   */
  static fromStringArray(fields: string[]): LazyRow {
    return new StringArrayLazyRow(fields);
  }

  /**
   * Wrap one row in the layout {@link LazyRow.toBinary} writes as a
   * binary-backed LazyRow. The bytes are not copied or checked.
   *
   * @param data The row's bytes.
   * @param fieldBoundaries The byte offset in `data` where each field starts.
   *   When given, the header in `data` is not read, and the row has
   *   `fieldBoundaries.length` fields, the last running to the end of `data`.
   */
  static fromBinary(data: Uint8Array, fieldBoundaries?: number[]): LazyRow {
    return new BinaryLazyRow(data, fieldBoundaries);
  }
}

class StringArrayLazyRow extends LazyRow {
  constructor(private fields: string[]) {
    super();
  }

  get columnCount(): number {
    return this.fields.length;
  }

  getField(index: number): string {
    if (index < 0 || index >= this.fields.length) {
      throw new RangeError(
        `Field index ${index} out of range [0, ${this.fields.length})`,
      );
    }
    return this.fields[index];
  }

  setField(index: number, value: string): void {
    if (index < 0 || index >= this.fields.length) {
      throw new RangeError(
        `Field index ${index} out of range [0, ${this.fields.length})`,
      );
    }
    this.fields[index] = value;
  }

  toStringArray(): string[] {
    return [...this.fields];
  }

  isBinaryBacked(): boolean {
    return false;
  }

  toBinary(): Uint8Array {
    // Create binary format: field_count + field_lengths + field_data
    const fieldBytes = this.fields.map((field) => encode(field));
    const totalDataSize = fieldBytes.reduce(
      (sum, bytes) => sum + bytes.length,
      0,
    );
    const headerSize = 4 + (this.fields.length * 4); // field_count + field_lengths

    const buffer = new Uint8Array(headerSize + totalDataSize);
    const view = new DataView(buffer.buffer);

    // Write field count
    view.setUint32(0, this.fields.length, true);

    // Write field lengths and data
    let offset = 4 + (this.fields.length * 4);
    for (let i = 0; i < this.fields.length; i++) {
      const fieldData = fieldBytes[i];
      view.setUint32(4 + (i * 4), fieldData.length, true);
      buffer.set(fieldData, offset);
      offset += fieldData.length;
    }

    return buffer;
  }
}

class BinaryLazyRow extends LazyRow {
  private fieldCache = new Map<number, string>();
  private fieldBoundaries: number[];
  private modifications?: Map<number, string>;

  constructor(private data: Uint8Array, fieldBoundaries?: number[]) {
    super();
    if (fieldBoundaries) {
      this.fieldBoundaries = fieldBoundaries;
    } else {
      // Parse header to get field boundaries
      this.fieldBoundaries = this.parseFieldBoundaries();
    }
  }

  private parseFieldBoundaries(): number[] {
    const view = new DataView(this.data.buffer, this.data.byteOffset);
    const fieldCount = view.getUint32(0, true);
    const boundaries: number[] = [];

    let offset = 4 + (fieldCount * 4);
    for (let i = 0; i < fieldCount; i++) {
      const fieldLength = view.getUint32(4 + (i * 4), true);
      boundaries.push(offset);
      offset += fieldLength;
    }

    return boundaries;
  }

  get columnCount(): number {
    return this.fieldBoundaries.length;
  }

  getField(index: number): string {
    if (index < 0 || index >= this.fieldBoundaries.length) {
      throw new RangeError(
        `Field index ${index} out of range [0, ${this.fieldBoundaries.length})`,
      );
    }

    if (this.modifications?.has(index)) {
      return this.modifications.get(index)!;
    }

    if (this.fieldCache.has(index)) {
      return this.fieldCache.get(index)!;
    }

    const start = this.fieldBoundaries[index];
    const end = index < this.fieldBoundaries.length - 1
      ? this.fieldBoundaries[index + 1]
      : this.data.length;

    const fieldData = this.data.slice(start, end);
    const field = decode(fieldData);
    this.fieldCache.set(index, field);

    return field;
  }

  setField(index: number, value: string): void {
    if (index < 0 || index >= this.fieldBoundaries.length) {
      throw new RangeError(
        `Field index ${index} out of range [0, ${this.fieldBoundaries.length})`,
      );
    }
    if (!this.modifications) {
      this.modifications = new Map();
    }
    this.modifications.set(index, value);
  }

  toStringArray(): string[] {
    const fields: string[] = [];
    for (let i = 0; i < this.fieldBoundaries.length; i++) {
      fields.push(this.getField(i));
    }
    return fields;
  }

  isBinaryBacked(): boolean {
    return true;
  }

  toBinary(): Uint8Array {
    if (!this.modifications) {
      return this.data;
    }

    // Apply modifications by converting to array, modifying, and re-serializing
    const fields: string[] = [];
    for (let i = 0; i < this.fieldBoundaries.length; i++) {
      fields.push(this.getField(i));
    }

    const fieldBytes = fields.map((field) => encode(field));
    const totalDataSize = fieldBytes.reduce(
      (sum, bytes) => sum + bytes.length,
      0,
    );
    const headerSize = 4 + (fields.length * 4);

    const buffer = new Uint8Array(headerSize + totalDataSize);
    const view = new DataView(buffer.buffer);

    view.setUint32(0, fields.length, true);

    let offset = 4 + (fields.length * 4);
    for (let i = 0; i < fields.length; i++) {
      const fieldData = fieldBytes[i];
      view.setUint32(4 + (i * 4), fieldData.length, true);
      buffer.set(fieldData, offset);
      offset += fieldData.length;
    }

    return buffer;
  }
}
