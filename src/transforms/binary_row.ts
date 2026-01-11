/**
 * High-performance binary row representation optimized for read-only field access.
 * 
 * Format:
 * - int32: Number of columns (N)
 * - int32[N]: Byte offsets (end position of each column in data)
 * - UTF-8 data: Concatenated field values
 */
export class BinaryRow {
  private decoder = new TextDecoder('utf-8', { fatal: true });

  constructor(private data: Uint8Array) {
    if (data.length < 4) {
      throw new Error('BinaryRow data too short');
    }
  }

  get columnCount(): number {
    const view = new DataView(this.data.buffer, this.data.byteOffset);
    return view.getInt32(0, true); // little-endian
  }

  getField(index: number): string {
    const columnCount = this.columnCount;
    if (index < 0 || index >= columnCount) {
      throw new Error(`Field index ${index} out of range [0, ${columnCount})`);
    }

    const view = new DataView(this.data.buffer, this.data.byteOffset);
    const offsetsStart = 4;
    const dataStart = offsetsStart + columnCount * 4;
    
    const startOffset = index === 0 ? dataStart : 
      dataStart + view.getInt32(offsetsStart + (index - 1) * 4, true);
    const endOffset = dataStart + view.getInt32(offsetsStart + index * 4, true);
    
    const fieldBytes = this.data.subarray(startOffset, endOffset);
    return this.decoder.decode(fieldBytes);
  }

  toStringArray(): string[] {
    const columnCount = this.columnCount;
    const result = new Array<string>(columnCount);
    
    const view = new DataView(this.data.buffer, this.data.byteOffset);
    const offsetsStart = 4;
    const dataStart = offsetsStart + columnCount * 4;
    
    let prevOffset = dataStart;
    for (let i = 0; i < columnCount; i++) {
      const endOffset = dataStart + view.getInt32(offsetsStart + i * 4, true);
      const fieldBytes = this.data.subarray(prevOffset, endOffset);
      result[i] = this.decoder.decode(fieldBytes);
      prevOffset = endOffset;
    }
    
    return result;
  }

  static fromStringArray(fields: string[]): BinaryRow {
    const encoder = new TextEncoder();
    const columnCount = fields.length;
    
    // Encode all fields and calculate total size
    const encodedFields = fields.map(field => encoder.encode(field));
    const totalDataSize = encodedFields.reduce((sum, field) => sum + field.length, 0);
    
    // Allocate buffer: 4 bytes for count + 4*N bytes for offsets + data
    const bufferSize = 4 + columnCount * 4 + totalDataSize;
    const buffer = new Uint8Array(bufferSize);
    const view = new DataView(buffer.buffer);
    
    // Write column count
    view.setInt32(0, columnCount, true);
    
    // Write field data and offsets
    const offsetsStart = 4;
    const dataStart = offsetsStart + columnCount * 4;
    let currentOffset = 0;
    
    for (let i = 0; i < columnCount; i++) {
      const fieldData = encodedFields[i];
      buffer.set(fieldData, dataStart + currentOffset);
      currentOffset += fieldData.length;
      
      // Write end offset for this field
      view.setInt32(offsetsStart + i * 4, currentOffset, true);
    }
    
    return new BinaryRow(buffer);
  }
}
