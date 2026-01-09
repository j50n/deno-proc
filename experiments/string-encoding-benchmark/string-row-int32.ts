const DECODER = new TextDecoder('utf-8')

/**
 * StringRow using Int32Array (signed 32-bit) - should fit in V8's SMI range
 */
export class StringRowInt32 {
  private _originalBuffer: Uint8Array;
  private allData: Int32Array; // Signed 32-bit array
  private allText: string;
  private _columnCount: number;
  private changes = new Map<number, string>();
  private _isDirty = false;
  
  constructor(buffer: Uint8Array) {
    this._originalBuffer = buffer;
    this.allData = new Int32Array(buffer.buffer, 0, buffer.length >>> 2);
    this._columnCount = this.allData[0];
    
    const dataSize = 1 + this._columnCount + 1;
    const indicesEnd = dataSize << 2;
    const textBytes = buffer.subarray(indicesEnd);
    this.allText = DECODER.decode(textBytes);
  }

  static fromArray(columns: string[]): StringRowInt32 {
    const serialized = serializeStringRowInt32(columns);
    return new StringRowInt32(serialized);
  }

  get columnCount(): number { return this._columnCount; }
  get isDirty(): boolean { return this._isDirty; }

  private getUnchecked(columnIndex: number): string {
    if (this._isDirty && this.changes.has(columnIndex)) {
      return this.changes.get(columnIndex)!;
    }
    
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex];
    return this.allText.substring(startPos, endPos);
  }

  private getClean(columnIndex: number): string {
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex];
    return this.allText.substring(startPos, endPos);
  }

  getUnsafe(columnIndex: number): string {
    return this.getUnchecked(columnIndex);
  }

  toArray(): string[] {
    const result = new Array<string>(this._columnCount);
    for (let i = 0; i < this._columnCount; i++) {
      result[i] = this.getClean(i);
    }
    return result;
  }

  toBytes(): Uint8Array {
    return this._originalBuffer;
  }
}

function serializeStringRowInt32(columns: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const allText = columns.join('');
  const textBytes = encoder.encode(allText);
  
  const positions: number[] = [];
  let charPos = 0;
  
  for (const col of columns) {
    positions.push(charPos);
    charPos += col.length;
  }
  positions.push(charPos);
  
  const headerSize = 4;
  const positionsSize = positions.length << 2;
  const totalSize = headerSize + positionsSize + textBytes.length;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  view.setInt32(0, columns.length, true); // Use setInt32 instead of setUint32
  
  for (let i = 0; i < positions.length; i++) {
    view.setInt32(4 + (i << 2), positions[i], true); // Use setInt32
  }
  
  bytes.set(textBytes, headerSize + positionsSize);
  return bytes;
}
