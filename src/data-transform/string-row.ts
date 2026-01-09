const DECODER = new TextDecoder('utf-8')
const ENCODER = new TextEncoder() // Shared encoder for serialization

/**
 * A row of string data with efficient serialization and sparse change tracking.
 * Uses Int32Array for optimal V8 SMI performance.
 */
export class StringRow {
  private _originalBuffer: Uint8Array;
  private allData: Int32Array; // Int32Array for SMI optimization
  private allText: string; // Decoded once in constructor
  private _columnCount: number;
  private changes = new Map<number, string>(); // Sparse storage for changes
  private _isDirty = false;
  
  /**
   * Create a new StringRow from serialized bytes.
   * @param buffer - Serialized row data bytes
   */
  constructor(buffer: Uint8Array) {
    this._originalBuffer = buffer;
    
    // Int32Array for everything - get column count from it
    this.allData = new Int32Array(buffer.buffer, 0, buffer.length >>> 2);
    this._columnCount = this.allData[0];
    
    // Decode text once at construction
    const dataSize = 1 + this._columnCount + 1; // header + positions + final position
    const indicesEnd = dataSize << 2;
    const textBytes = buffer.subarray(indicesEnd);
    this.allText = DECODER.decode(textBytes);
  }

  /**
   * Create a StringRow from an array of column values.
   * @param columns - Array of string column values
   * @returns New StringRow instance
   */
  static fromArray(columns: string[]): StringRow {
    const serialized = serializeStringRow(columns);
    return new StringRow(serialized);
  }

  /**
   * Create a StringRow from serialized bytes.
   * @param buffer - Serialized row data bytes
   * @returns New StringRow instance
   */
  static fromBytes(buffer: Uint8Array): StringRow {
    return new StringRow(buffer);
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
    const endPos = this.allData[2 + columnIndex ];
    return this.allText.substring(startPos, endPos);
  }

  // Clean version - no dirty check, no changes check
  private getClean(columnIndex: number): string {
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex ];
    return this.allText.substring(startPos, endPos);
  }

  // Dirty version - assumes dirty, checks changes
  private getDirty(columnIndex: number): string {
    const changed = this.changes.get(columnIndex);
    if (changed !== undefined) {
      return changed;
    }
    
    const startPos = this.allData[1 + columnIndex];
    const endPos = this.allData[2 + columnIndex ];
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
    const endPos = this.allData[2 + columnIndex ];
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
   * Get list of changed column indices in sorted order.
   * @returns Array of column indices that have been modified
   */
  getChangedColumns(): number[] {
    return this._isDirty ? Array.from(this.changes.keys()).sort((a, b) => a - b) : [];
  }

  /**
   * Get all changes with old and new values.
   * @returns Array of change objects with columnIndex, oldValue, and newValue
   */
  getChanges(): Array<{columnIndex: number, oldValue: string, newValue: string}> {
    if (!this._isDirty) return [];
    
    const result: Array<{columnIndex: number, oldValue: string, newValue: string}> = [];
    
    for (const [columnIndex, newValue] of this.changes) {
      // Get original value directly from text data (bypass change tracking)
      const startPos = this.allData[1 + columnIndex];
      const endPos = this.allData[2 + columnIndex];
      const oldValue = this.allText.substring(startPos, endPos);
      
      result.push({ columnIndex, oldValue, newValue });
    }
    
    return result.sort((a, b) => a.columnIndex - b.columnIndex);
  }

  /**
   * Reset all changes and mark row as clean.
   */
  resetChanges(): void {
    this.changes.clear();
    this._isDirty = false;
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
    return serializeStringRow(columns);
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

  // Iterator support (includes changes) - optimized
  *[Symbol.iterator](): Iterator<string> {
    if (!this._isDirty) {
      // Clean path - no changes to check
      for (let i = 0; i < this._columnCount; i++) {
        yield this.getClean(i);
      }
    } else {
      // Dirty path - check for changes
      for (let i = 0; i < this._columnCount; i++) {
        yield this.getDirty(i);
      }
    }
  }

  /**
   * Get a slice of the row columns.
   * @param start - Start column index (inclusive)
   * @param end - End column index (exclusive)
   * @returns Array slice of column values
   */
  slice(start?: number, end?: number): string[] {
    const s = start ?? 0;
    const e = end ?? this._columnCount;
    const result: string[] = [];
    
    if (!this._isDirty) {
      // Clean path
      for (let i = s; i < e && i < this._columnCount; i++) {
        result.push(this.getClean(i));
      }
    } else {
      // Dirty path
      for (let i = s; i < e && i < this._columnCount; i++) {
        result.push(this.getDirty(i));
      }
    }
    
    return result;
  }

  /**
   * Get first n column values.
   * @param n - Number of columns to return (default: 1)
   * @returns Array of first n column values
   */
  first(n: number = 1): string[] {
    return this.slice(0, n);
  }
}

/**
 * Serialize string row to efficient binary format using Int32Array.
 * Format: [columnCount:int32][positions:int32...][text_data]
 * @param columns - Array of column values to serialize
 * @returns Serialized bytes
 */
function serializeStringRow(columns: string[]): Uint8Array {
  let allText = '';
  for (const col of columns) {
    allText += col;
  }
  const textBytes = ENCODER.encode(allText);
  
  const headerSize = 4; // int32 for column count
  const positionsSize = (columns.length + 1) << 2; // int32 positions
  const totalSize = headerSize + positionsSize + textBytes.length;
  
  // Allocate final buffer once
  const bytes = new Uint8Array(totalSize);
  
  // Create Int32Array view over header+positions section
  const int32View = new Int32Array(bytes.buffer, 0, 1 + columns.length + 1);
  
  // Write column count
  int32View[0] = columns.length;
  
  // Write positions directly to Int32Array
  let charPos = 0;
  for (let i = 0; i < columns.length; i++) {
    int32View[1 + i] = charPos;
    charPos += columns[i].length;
  }
  int32View[1 + columns.length] = charPos; // Final position
  
  // Write text data
  bytes.set(textBytes, headerSize + positionsSize);
  return bytes;
}
