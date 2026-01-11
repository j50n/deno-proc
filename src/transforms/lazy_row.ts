const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

export abstract class LazyRow {
  abstract readonly columnCount: number;
  abstract getField(index: number): string;
  abstract toStringArray(): string[];
  abstract toBinary(): Uint8Array;

  static fromStringArray(fields: string[]): LazyRow {
    return new StringArrayLazyRow(fields);
  }

  static fromBinary(data: Uint8Array, fieldBoundaries?: number[]): LazyRow {
    return new BinaryLazyRow(data, fieldBoundaries);
  }
}

class StringArrayLazyRow extends LazyRow {
  private binaryCache?: Uint8Array;

  constructor(private fields: string[]) {
    super();
  }

  get columnCount(): number {
    return this.fields.length;
  }

  getField(index: number): string {
    if (index < 0 || index >= this.fields.length) {
      throw new RangeError(`Field index ${index} out of range [0, ${this.fields.length})`);
    }
    return this.fields[index];
  }

  toStringArray(): string[] {
    return [...this.fields];
  }

  toBinary(): Uint8Array {
    if (this.binaryCache) {
      return this.binaryCache;
    }

    // Create binary format: field_count + field_lengths + field_data
    const fieldBytes = this.fields.map(field => encoder.encode(field));
    const totalDataSize = fieldBytes.reduce((sum, bytes) => sum + bytes.length, 0);
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

    this.binaryCache = buffer;
    return buffer;
  }
}

class BinaryLazyRow extends LazyRow {
  private stringCache?: string[];
  private fieldCache = new Map<number, string>();
  private fieldBoundaries: number[];

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
      throw new RangeError(`Field index ${index} out of range [0, ${this.fieldBoundaries.length})`);
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

  toStringArray(): string[] {
    if (this.stringCache) {
      return [...this.stringCache];
    }

    const fields: string[] = [];
    for (let i = 0; i < this.fieldBoundaries.length; i++) {
      fields.push(this.getField(i));
    }

    this.stringCache = fields;
    return [...fields];
  }

  toBinary(): Uint8Array {
    return this.data;
  }
}
