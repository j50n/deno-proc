#!/usr/bin/env -S deno run

class MutableSingleDecodeArray {
  private _originalBuffer: Uint8Array;
  private view: DataView;
  private allText: string | null = null;
  private _length: number;
  private changes = new Map<number, string>(); // Sparse storage for changes
  private _isDirty = false;
  
  constructor(buffer: Uint8Array) {
    this._originalBuffer = buffer; // Keep reference to original
    this.view = new DataView(buffer.buffer);
    this._length = this.view.getUint32(0, true);
  }
  
  get originalBuffer(): Uint8Array {
    return this._originalBuffer;
  }
  
  get length(): number {
    return this._length;
  }
  
  get isDirty(): boolean {
    return this._isDirty;
  }
  
  get changeCount(): number {
    return this.changes.size;
  }
  
  private ensureTextDecoded(): void {
    if (this.allText === null) {
      const indicesEnd = (1 + this._length + 1) * 4;
      const textBytes = new Uint8Array(this.view.buffer).subarray(indicesEnd);
      this.allText = new TextDecoder('utf-8').decode(textBytes);
    }
  }
  
  get(index: number): string {
    if (index < 0 || index >= this._length) {
      throw new Error(`Index ${index} out of bounds [0, ${this._length})`);
    }
    
    // Check if we have a change for this index
    if (this.changes.has(index)) {
      return this.changes.get(index)!;
    }
    
    // Otherwise get from original data
    this.ensureTextDecoded();
    
    const startPos = this.view.getUint32((1 + index) * 4, true);
    const endPos = this.view.getUint32((1 + index + 1) * 4, true);
    
    return this.allText!.substring(startPos, endPos);
  }
  
  set(index: number, value: string): void {
    if (index < 0 || index >= this._length) {
      throw new Error(`Index ${index} out of bounds [0, ${this._length})`);
    }
    
    // Get original value to check if it's actually changing
    const originalValue = this.get(index);
    
    if (originalValue === value) {
      // Value is same as original, remove from changes if it exists
      if (this.changes.has(index)) {
        this.changes.delete(index);
        this._isDirty = this.changes.size > 0;
      }
    } else {
      // Value is different, store the change
      this.changes.set(index, value);
      this._isDirty = true;
    }
  }
  
  // Get list of changed indices
  getChangedIndices(): number[] {
    return Array.from(this.changes.keys()).sort((a, b) => a - b);
  }
  
  // Get all changes as key-value pairs
  getChanges(): Array<{index: number, oldValue: string, newValue: string}> {
    const result: Array<{index: number, oldValue: string, newValue: string}> = [];
    
    for (const [index, newValue] of this.changes) {
      // Get original value (temporarily remove from changes to get original)
      this.changes.delete(index);
      const oldValue = this.get(index);
      this.changes.set(index, newValue);
      
      result.push({ index, oldValue, newValue });
    }
    
    return result.sort((a, b) => a.index - b.index);
  }
  
  // Reset all changes
  resetChanges(): void {
    this.changes.clear();
    this._isDirty = false;
  }
  
  // Serialize back to bytes (original if unchanged, recreated if changed)
  toBytes(): Uint8Array {
    if (!this._isDirty) {
      // No changes, return original bytes
      return this._originalBuffer;
    }
    
    // Has changes, need to recreate
    const strings = this.toArray();
    return serializeToSingleDecode(strings);
  }
  
  // Convert to regular array (includes changes)
  toArray(): string[] {
    const result = new Array<string>(this._length);
    for (let i = 0; i < this._length; i++) {
      result[i] = this.get(i);
    }
    return result;
  }
  
  // Iterator support (includes changes)
  *[Symbol.iterator](): Iterator<string> {
    for (let i = 0; i < this._length; i++) {
      yield this.get(i);
    }
  }
  
  // Array-like methods
  slice(start?: number, end?: number): string[] {
    const s = start ?? 0;
    const e = end ?? this._length;
    const result: string[] = [];
    for (let i = s; i < e && i < this._length; i++) {
      result.push(this.get(i));
    }
    return result;
  }
  
  first(n: number = 1): string[] {
    return this.slice(0, n);
  }
}

// Serialization function (same as before)
function serializeToSingleDecode(strings: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const allText = strings.join('');
  const textBytes = encoder.encode(allText);
  
  const indices: number[] = [strings.length];
  let charPos = 0;
  
  for (const str of strings) {
    indices.push(charPos);
    charPos += str.length;
  }
  indices.push(charPos);
  
  const indicesBytes = indices.length * 4;
  const totalSize = indicesBytes + textBytes.length;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  for (let i = 0; i < indices.length; i++) {
    view.setUint32(i * 4, indices[i], true);
  }
  
  bytes.set(textBytes, indicesBytes);
  return bytes;
}

// Test the mutable class
function testMutableSingleDecodeArray() {
  console.log("MutableSingleDecodeArray Performance Test");
  console.log("=========================================");
  
  // Generate test data
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const columns: string[] = [];
  
  for (let i = 0; i < 100; i++) { // Reduced from 1000
    const length = Math.floor(Math.random() * 10) + 5; // 5-15 chars
    let column = "";
    for (let j = 0; j < length; j++) {
      column += chars[Math.floor(Math.random() * chars.length)];
    }
    columns.push(column);
  }
  
  console.log(`Test data: ${columns.length} strings`);
  
  // Serialize and create mutable array
  const serialized = serializeToSingleDecode(columns);
  const arr = new MutableSingleDecodeArray(serialized);
  
  console.log(`Original size: ${serialized.length} bytes`);
  console.log(`Initial state: isDirty=${arr.isDirty}, changes=${arr.changeCount}`);
  
  // Test 1: Read performance (should be same as before)
  console.log("\nTest 1: Read performance (first 5 items)");
  
  const readStart = performance.now();
  for (let iter = 0; iter < 100; iter++) { // Reduced iterations
    for (let i = 0; i < 5; i++) {
      arr.get(i);
    }
  }
  const readEnd = performance.now();
  
  console.log(`Read time: ${(readEnd - readStart).toFixed(2)}ms`);
  console.log(`Per operation: ${((readEnd - readStart) / 100).toFixed(3)}ms`);
  
  // Test 2: Make some changes (sparse)
  console.log("\nTest 2: Making sparse changes");
  
  const originalValues = [arr.get(10), arr.get(50), arr.get(90)];
  console.log(`Original values: ${JSON.stringify(originalValues)}`);
  
  // Make changes
  arr.set(10, "CHANGED_10");
  arr.set(50, "CHANGED_50");  
  arr.set(90, "CHANGED_90");
  
  console.log(`After changes: isDirty=${arr.isDirty}, changes=${arr.changeCount}`);
  console.log(`Changed values: ${JSON.stringify([arr.get(10), arr.get(50), arr.get(90)])}`);
  console.log(`Changed indices: ${JSON.stringify(arr.getChangedIndices())}`);
  
  // Test 3: Change performance
  console.log("\nTest 3: Change performance");
  
  const changeStart = performance.now();
  for (let iter = 0; iter < 50; iter++) { // Much smaller
    arr.set(iter % 10, `TEMP_${iter}`);
  }
  const changeEnd = performance.now();
  
  console.log(`Change time: ${(changeEnd - changeStart).toFixed(2)}ms`);
  console.log(`Per change: ${((changeEnd - changeStart) / 50).toFixed(3)}ms`);
  console.log(`Final changes: ${arr.changeCount}`);
  
  // Test 4: Mixed read/write performance
  console.log("\nTest 4: Mixed read/write (realistic usage)");
  
  arr.resetChanges();
  
  const mixedStart = performance.now();
  for (let iter = 0; iter < 100; iter++) { // Reduced
    // Read first 5 items
    for (let i = 0; i < 5; i++) {
      arr.get(i);
    }
    
    // Occasionally change something (5% chance)
    if (Math.random() < 0.05) {
      const index = Math.floor(Math.random() * arr.length);
      arr.set(index, `MODIFIED_${iter}`);
    }
  }
  const mixedEnd = performance.now();
  
  console.log(`Mixed time: ${(mixedEnd - mixedStart).toFixed(2)}ms`);
  console.log(`Per operation: ${((mixedEnd - mixedStart) / 100).toFixed(3)}ms`);
  console.log(`Final changes: ${arr.changeCount}`);
  
  // Test 5: Show change tracking
  console.log("\nTest 5: Change tracking details");
  const changes = arr.getChanges();
  console.log(`Total changes tracked: ${changes.length}`);
  if (changes.length > 0) {
    console.log(`First few changes:`, changes.slice(0, 3));
  }
  
  // Test 6: toBytes() method
  console.log("\nTest 6: toBytes() serialization");
  
  // Test with no changes
  arr.resetChanges();
  const originalBytes = arr.toBytes();
  console.log(`No changes - same bytes: ${originalBytes === arr.originalBuffer}`);
  console.log(`Original size: ${serialized.length}, returned size: ${originalBytes.length}`);
  
  // Test with changes
  arr.set(5, "MODIFIED");
  arr.set(15, "ALSO_MODIFIED");
  const modifiedBytes = arr.toBytes();
  console.log(`With changes - new bytes: ${modifiedBytes !== arr.originalBuffer}`);
  console.log(`Modified size: ${modifiedBytes.length} bytes`);
  
  // Verify the modified bytes work correctly
  const newArr = new MutableSingleDecodeArray(modifiedBytes);
  console.log(`Roundtrip works: ${newArr.get(5) === "MODIFIED" && newArr.get(15) === "ALSO_MODIFIED"}`);
  console.log(`Roundtrip clean: isDirty=${newArr.isDirty}, changes=${newArr.changeCount}`);
  
  // Memory efficiency check
  console.log("\nMemory efficiency:");
  console.log(`Original data: ${serialized.length} bytes`);
  console.log(`Changes stored: ${arr.changeCount} items`);
  console.log(`Estimated change overhead: ~${arr.changeCount * 50} bytes`); // Rough estimate
  console.log(`Change ratio: ${((arr.changeCount / arr.length) * 100).toFixed(2)}%`);
}

testMutableSingleDecodeArray();
