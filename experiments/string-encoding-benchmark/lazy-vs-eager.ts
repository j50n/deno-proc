#!/usr/bin/env -S deno run

// Test performance difference between lazy and eager text decoding

// Lazy version (old)
class LazyDecodeArray {
  private view: DataView;
  private allText: string | null = null;
  private _length: number;
  
  constructor(buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer);
    this._length = this.view.getUint32(0, true);
  }
  
  get length(): number { return this._length; }
  
  private ensureTextDecoded(): void {
    if (this.allText === null) {
      const indicesEnd = (1 + this._length + 1) * 4;
      const textBytes = new Uint8Array(this.view.buffer).subarray(indicesEnd);
      this.allText = new TextDecoder('utf-8').decode(textBytes);
    }
  }
  
  get(index: number): string {
    this.ensureTextDecoded();
    const startPos = this.view.getUint32((1 + index) * 4, true);
    const endPos = this.view.getUint32((1 + index + 1) * 4, true);
    return this.allText!.substring(startPos, endPos);
  }
}

// Eager version (new)
class EagerDecodeArray {
  private view: DataView;
  private allText: string;
  private _length: number;
  
  constructor(buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer);
    this._length = this.view.getUint32(0, true);
    
    // Decode immediately
    const indicesEnd = (1 + this._length + 1) * 4;
    const textBytes = new Uint8Array(this.view.buffer).subarray(indicesEnd);
    this.allText = new TextDecoder('utf-8').decode(textBytes);
  }
  
  get length(): number { return this._length; }
  
  get(index: number): string {
    const startPos = this.view.getUint32((1 + index) * 4, true);
    const endPos = this.view.getUint32((1 + index + 1) * 4, true);
    return this.allText.substring(startPos, endPos);
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

function testPerformanceDifference() {
  console.log("Lazy vs Eager Text Decoding Performance");
  console.log("======================================");
  
  // Generate test data
  const testData: string[] = [];
  for (let i = 0; i < 100; i++) {
    testData.push(`string_${i}_with_some_content`);
  }
  
  const serialized = serializeToSingleDecode(testData);
  console.log(`Test data: ${testData.length} strings, ${serialized.length} bytes`);
  
  const iterations = 1000;
  
  // Test lazy version
  console.log("\nLazy decoding (decode on first access):");
  let lazyTime = 0;
  for (let test = 0; test < 5; test++) {
    const start = performance.now();
    for (let iter = 0; iter < iterations; iter++) {
      const arr = new LazyDecodeArray(serialized);
      // Access first 5 items
      for (let i = 0; i < 5; i++) {
        arr.get(i);
      }
    }
    const end = performance.now();
    lazyTime += end - start;
  }
  lazyTime /= 5; // Average
  console.log(`Average time: ${lazyTime.toFixed(2)}ms`);
  console.log(`Per operation: ${(lazyTime / iterations).toFixed(3)}ms`);
  
  // Test eager version
  console.log("\nEager decoding (decode in constructor):");
  let eagerTime = 0;
  for (let test = 0; test < 5; test++) {
    const start = performance.now();
    for (let iter = 0; iter < iterations; iter++) {
      const arr = new EagerDecodeArray(serialized);
      // Access first 5 items
      for (let i = 0; i < 5; i++) {
        arr.get(i);
      }
    }
    const end = performance.now();
    eagerTime += end - start;
  }
  eagerTime /= 5; // Average
  console.log(`Average time: ${eagerTime.toFixed(2)}ms`);
  console.log(`Per operation: ${(eagerTime / iterations).toFixed(3)}ms`);
  
  // Compare
  const speedup = lazyTime / eagerTime;
  console.log(`\nSpeedup: ${speedup.toFixed(2)}x faster with eager decoding`);
  
  // Test construction-only cost
  console.log("\nConstruction-only cost:");
  
  const lazyConstructStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    new LazyDecodeArray(serialized);
  }
  const lazyConstructEnd = performance.now();
  
  const eagerConstructStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    new EagerDecodeArray(serialized);
  }
  const eagerConstructEnd = performance.now();
  
  console.log(`Lazy construction: ${(lazyConstructEnd - lazyConstructStart).toFixed(2)}ms`);
  console.log(`Eager construction: ${(eagerConstructEnd - eagerConstructStart).toFixed(2)}ms`);
  console.log(`Eager overhead: ${((eagerConstructEnd - eagerConstructStart) - (lazyConstructEnd - lazyConstructStart)).toFixed(2)}ms`);
}

testPerformanceDifference();
