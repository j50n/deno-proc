const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

/**
 * Lazy row representation for efficient field access.
 *
 * LazyRow defers string conversion until fields are actually accessed,
 * providing better performance when you only need specific fields from
 * large datasets.
 *
 * **Performance**: Using LazyRow with CSV parsing can be 1.05-1.7x faster
 * than parsing to string arrays when accessing only a subset of fields.
 *
 * **Two implementations**:
 * - `fromStringArray()`: Wraps existing string array, converts to binary on demand
 * - `fromBinary()`: Wraps binary data, converts to strings on demand
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
 * @example Use with transforms
 * ```typescript
 * import { read } from "jsr:@j50n/proc";
 * import { fromCsvToLazyRows } from "jsr:@j50n/proc/transforms";
 *
 * await read("users.csv")
 *   .transform(fromCsvToLazyRows())
 *   .flatten()
 *   .filter(row => row.getField(2) === "active")
 *   .map(row => row.getField(0))
 *   .forEach(name => console.log(name));
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
   * Set a field by index.
   * @param index Zero-based field index.
   * @param value New field value.
   * @throws RangeError if index is out of bounds.
   */
  abstract setField(index: number, value: string): void;

  /**
   * Convert to a string array.
   * @returns All fields as a string array.
   */
  abstract toStringArray(): string[];

  /**
   * Convert to binary representation.
   * @returns Binary data suitable for Record format.
   */
  abstract toBinary(): Uint8Array;

  /**
   * Check if this LazyRow is backed by binary data.
   * @returns true if backed by binary, false if backed by string array.
   */
  abstract isBinaryBacked(): boolean;

  /**
   * Create a LazyRow from a string array.
   *
   * Use this when you have parsed data and want to wrap it for
   * consistent API access or later binary conversion.
   *
   * @param fields Array of field values.
   * @returns A LazyRow wrapping the fields.
   */
  static fromStringArray(fields: string[]): LazyRow {
    return new StringArrayLazyRow(fields);
  }

  /**
   * Create a LazyRow from binary data.
   *
   * Use this when reading from Record format for maximum performance.
   * String conversion is deferred until fields are accessed.
   *
   * @param data Binary row data.
   * @param fieldBoundaries Optional pre-computed field boundaries.
   * @returns A LazyRow wrapping the binary data.
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
    const fieldBytes = this.fields.map((field) => encoder.encode(field));
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
    const field = decoder.decode(fieldData);
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

    const fieldBytes = fields.map((field) => encoder.encode(field));
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
