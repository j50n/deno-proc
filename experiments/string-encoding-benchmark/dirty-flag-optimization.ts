#!/usr/bin/env -S deno run

// Test performance difference between dirty flag optimization

// Unoptimized version (always checks Map)
class UnoptimizedArray {
  private view: DataView;
  private allText: string;
  private _length: number;
  private changes = new Map<number, string>();
  private _isDirty = false;
  
  constructor(buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer);
    this._length = this.view.getUint32(0, true);
    
    const indicesEnd = (1 + this._length + 1) * 4;
    const textBytes = new Uint8Array(this.view.buffer).subarray(indicesEnd);
    this.allText = new TextDecoder('utf-8').decode(textBytes);
  }
  
  get length(): number { return this._length; }
  get isDirty(): boolean { return this._isDirty; }
  
  get(index: number): string {
    // Always check Map first (unoptimized)
    if (this.changes.has(index)) {
      return this.changes.get(index)!;
    }
    
    const startPos = this.view.getUint32((1 + index) * 4, true);
    const endPos = this.view.getUint32((1 + index + 1) * 4, true);
    return this.allText.substring(startPos, endPos);
  }
  
  set(index: number, value: string): void {
    this.changes.set(index, value);
    this._isDirty = true;
  }
}

// Optimized version (checks dirty flag first)
class OptimizedArray {
  private view: DataView;
  private allText: string;
  private _length: number;
  private changes = new Map<number, string>();
  private _isDirty = false;
  
  constructor(buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer);
    this._length = this.view.getUint32(0, true);
    
    const indicesEnd = (1 + this._length + 1) * 4;
    const textBytes = new Uint8Array(this.view.buffer).subarray(indicesEnd);
    this.allText = new TextDecoder('utf-8').decode(textBytes);
  }
  
  get length(): number { return this._length; }
  get isDirty(): boolean { return this._isDirty; }
  
  get(index: number): string {
    // Fast path: no changes at all
    if (!this._isDirty) {
      const startPos = this.view.getUint32((1 + index) * 4, true);
      const endPos = this.view.getUint32((1 + index + 1) * 4, true);
      return this.allText.substring(startPos, endPos);
    }
    
    // Slow path: check for changes
    if (this.changes.has(index)) {
      return this.changes.get(index)!;
    }
    
    const startPos = this.view.getUint32((1 + index) * 4, true);
    const endPos = this.view.getUint32((1 + index + 1) * 4, true);
    return this.allText.substring(startPos, endPos);
  }
  
  set(index: number, value: string): void {
    this.changes.set(index, value);
    this._isDirty = true;
  }
}

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

function testDirtyFlagOptimization() {
  console.log("Dirty Flag Optimization Performance Test");
  console.log("=======================================");
  
  // Generate test data
  const testData: string[] = [];
  for (let i = 0; i < 100; i++) {
    testData.push(`string_${i}_content`);
  }
  
  const serialized = serializeToSingleDecode(testData);
  console.log(`Test data: ${testData.length} strings, ${serialized.length} bytes`);
  
  const iterations = 10000;
  
  // Test 1: Clean arrays (no changes) - this is where optimization helps most
  console.log("\nTest 1: Clean arrays (no changes)");
  
  // Unoptimized
  let unoptimizedTime = 0;
  for (let test = 0; test < 5; test++) {
    const arr = new UnoptimizedArray(serialized);
    const start = performance.now();
    for (let iter = 0; iter < iterations; iter++) {
      // Access first 5 items
      for (let i = 0; i < 5; i++) {
        arr.get(i);
      }
    }
    const end = performance.now();
    unoptimizedTime += end - start;
  }
  unoptimizedTime /= 5;
  
  // Optimized
  let optimizedTime = 0;
  for (let test = 0; test < 5; test++) {
    const arr = new OptimizedArray(serialized);
    const start = performance.now();
    for (let iter = 0; iter < iterations; iter++) {
      // Access first 5 items
      for (let i = 0; i < 5; i++) {
        arr.get(i);
      }
    }
    const end = performance.now();
    optimizedTime += end - start;
  }
  optimizedTime /= 5;
  
  console.log(`Unoptimized: ${unoptimizedTime.toFixed(2)}ms`);
  console.log(`Optimized: ${optimizedTime.toFixed(2)}ms`);
  console.log(`Speedup: ${(unoptimizedTime / optimizedTime).toFixed(2)}x faster`);
  
  // Test 2: Dirty arrays (with changes) - should be similar performance
  console.log("\nTest 2: Dirty arrays (with changes)");
  
  // Unoptimized with changes
  let unoptimizedDirtyTime = 0;
  for (let test = 0; test < 5; test++) {
    const arr = new UnoptimizedArray(serialized);
    arr.set(50, "CHANGED"); // Make it dirty
    const start = performance.now();
    for (let iter = 0; iter < iterations; iter++) {
      // Access first 5 items (unchanged)
      for (let i = 0; i < 5; i++) {
        arr.get(i);
      }
    }
    const end = performance.now();
    unoptimizedDirtyTime += end - start;
  }
  unoptimizedDirtyTime /= 5;
  
  // Optimized with changes
  let optimizedDirtyTime = 0;
  for (let test = 0; test < 5; test++) {
    const arr = new OptimizedArray(serialized);
    arr.set(50, "CHANGED"); // Make it dirty
    const start = performance.now();
    for (let iter = 0; iter < iterations; iter++) {
      // Access first 5 items (unchanged)
      for (let i = 0; i < 5; i++) {
        arr.get(i);
      }
    }
    const end = performance.now();
    optimizedDirtyTime += end - start;
  }
  optimizedDirtyTime /= 5;
  
  console.log(`Unoptimized (dirty): ${unoptimizedDirtyTime.toFixed(2)}ms`);
  console.log(`Optimized (dirty): ${optimizedDirtyTime.toFixed(2)}ms`);
  console.log(`Difference: ${((unoptimizedDirtyTime - optimizedDirtyTime) / unoptimizedDirtyTime * 100).toFixed(1)}%`);
  
  console.log(`\n✅ Dirty flag optimization provides ${(unoptimizedTime / optimizedTime).toFixed(2)}x speedup for clean arrays!`);
}

testDirtyFlagOptimization();
