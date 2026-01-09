const DECODER = new TextDecoder('utf-8')

/**
 * A row of string data with efficient serialization and sparse change tracking.
 * Uses 16-bit unsigned integers for positions and column count (max 65535 columns, 65535 chars per row).
 */
export class StringRow16 {
  private _originalBuffer: Uint8Array;
  private allData: Uint16Array; // 16-bit array for header + positions
  private allText: string; // Decoded once in constructor
  private _columnCount: number;
  private changes = new Map<number, string>(); // Sparse storage for changes
  private _isDirty = false;
  
  /**
   * Create a new StringRow16 from serialized bytes.
   * @param buffer - Serialized row data bytes
   */
  constructor(buffer: Uint8Array) {
    this._originalBuffer = buffer;
    
    // Single Uint16Array for everything - get column count from it
    this.allData = new Uint16Array(buffer.buffer, 0, buffer.length >>> 1);
    this._columnCount = this.allData[0];
    
    // Decode text once at construction
    const dataSize = 1 + this._columnCount + 1; // header + positions + final position
    const indicesEnd = dataSize << 1; // 16-bit = 2 bytes each
    const textBytes = buffer.subarray(indicesEnd);
    this.allText = DECODER.decode(textBytes);
  }

  /**
   * Create a StringRow16 from an array of column values.
   * @param columns - Array of string column values
   * @returns New StringRow16 instance
   */
  static fromArray(columns: string[]): StringRow16 {
    const serialized = serializeStringRow16(columns);
    return new StringRow16(serialized);
  }

  /**
   * Create a StringRow16 from serialized bytes.
   * @param buffer - Serialized row data bytes
   * @returns New StringRow16 instance
   */
  static fromBytes(buffer: Uint8Array): StringRow16 {
    return new StringRow16(buffer);
  }

  /** Number of columns in the row */
  get columnCount(): number { return this._columnCount; }
  /** Whether the row has been modified */
  get isDirty(): boolean { return this._isDirty; }
  /** Number of changed columns */
  get changeCount(): number { return this.changes.size; }

  // Internal get without bounds checking - optimized with single array access
  private getUnchecked(columnIndex: number): string {
    // Check for changes first (only if dirty)
    if (this._isDirty && this.changes.has(columnIndex)) {
      return this.changes.get(columnIndex)!;
    }
    
    // Get from original text using single array (positions start at index 1)
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex];
    return this.allText.substring(startPos, endPos);
  }

  // Clean version - no dirty check, no changes check
  private getClean(columnIndex: number): string {
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex];
    return this.allText.substring(startPos, endPos);
  }

  // Dirty version - assumes dirty, checks changes
  private getDirty(columnIndex: number): string {
    const changed = this.changes.get(columnIndex);
    if (changed !== undefined) {
      return changed;
    }
    
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex];
    return this.allText.substring(startPos, endPos);
  }

  /**
   * Get column value at the specified index.
   * @param columnIndex - Zero-based column index
   * @returns String value at the given column
   * @throws Error if columnIndex is out of bounds
   */
  get(columnIndex: number): string {
    if (columnIndex < 0 || columnIndex >= this._columnCount) {
      throw new Error(`Column index ${columnIndex} out of bounds [0, ${this._columnCount})`);
    }
    
    return this.getUnchecked(columnIndex);
  }

  /**
   * Get column value at the specified index without bounds checking.
   * WARNING: No bounds checking - will crash or return invalid data if index is out of bounds.
   * Use only when you are certain the columnIndex is valid.
   * @param columnIndex - Zero-based column index
   * @returns String value at the given column
   */
  getUnsafe(columnIndex: number): string {
    return this.getUnchecked(columnIndex);
  }

  /**
   * Set column value at the specified index.
   * @param columnIndex - Zero-based column index
   * @param value - New string value
   * @throws Error if columnIndex is out of bounds
   */
  set(columnIndex: number, value: string): void {
    if (columnIndex < 0 || columnIndex >= this._columnCount) {
      throw new Error(`Column index ${columnIndex} out of bounds [0, ${this._columnCount})`);
    }
    
    // Get original value directly using single array
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex];
    const originalValue = this.allText.substring(startPos, endPos);
    
    if (originalValue === value) {
      // Value is same as original, remove from changes if it exists
      if (this._isDirty && this.changes.has(columnIndex)) {
        this.changes.delete(columnIndex);
        this._isDirty = this.changes.size > 0;
      }
    } else {
      // Value is different, store the change
      this.changes.set(columnIndex, value);
      this._isDirty = true;
    }
  }

  /**
   * Convert to regular JavaScript array including all changes.
   * Uses optimized access paths based on dirty state.
   * @returns Array containing all column values with modifications applied
   */
  toArray(): string[] {
    const result = new Array<string>(this._columnCount);
    
    if (!this._isDirty) {
      // Clean path - no changes to check
      for (let i = 0; i < this._columnCount; i++) {
        result[i] = this.getClean(i);
      }
    } else {
      // Dirty path - check for changes
      for (let i = 0; i < this._columnCount; i++) {
        result[i] = this.getDirty(i);
      }
    }
    
    return result;
  }

  /**
   * Serialize back to bytes. Returns original buffer if unchanged, 
   * recreates if modified.
   * @returns Serialized bytes in row format
   */
  toBytes(): Uint8Array {
    if (!this._isDirty) {
      // No changes, return original bytes
      return this._originalBuffer;
    }
    
    // Has changes, need to recreate
    const columns = this.toArray();
    return serializeStringRow16(columns);
  }
}

/**
 * Serialize string row to efficient binary format using 16-bit positions.
 * Format: [columnCount:uint16][positions:uint16...][text_data]
 * @param columns - Array of column values to serialize
 * @returns Serialized bytes
 */
function serializeStringRow16(columns: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const allText = columns.join('');
  const textBytes = encoder.encode(allText);
  
  // Check limits
  if (columns.length > 65535) {
    throw new Error(`Too many columns: ${columns.length} (max 65535)`);
  }
  if (allText.length > 65535) {
    throw new Error(`Text too long: ${allText.length} chars (max 65535)`);
  }
  
  const positions: number[] = [];
  let charPos = 0;
  
  for (const col of columns) {
    positions.push(charPos);
    charPos += col.length;
  }
  positions.push(charPos); // Final position
  
  const headerSize = 2; // uint16 for column count
  const positionsSize = positions.length << 1; // uint16 positions
  const totalSize = headerSize + positionsSize + textBytes.length;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  // Write column count as uint16
  view.setUint16(0, columns.length, true);
  
  // Write positions as uint16
  for (let i = 0; i < positions.length; i++) {
    view.setUint16(2 + (i << 1), positions[i], true);
  }
  
  // Write text data
  bytes.set(textBytes, headerSize + positionsSize);
  return bytes;
}
