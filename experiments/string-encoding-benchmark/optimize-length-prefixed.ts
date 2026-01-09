#!/usr/bin/env -S deno run

// Current implementation (potentially inefficient)
function serializeStringsOld(strings: string[]): Uint8Array {
  let totalSize = 4;
  for (const str of strings) {
    totalSize += 4;
    totalSize += new TextEncoder().encode(str).length; // NEW ENCODER EACH TIME!
  }
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  let pos = 0;
  view.setUint32(pos, strings.length, true);
  pos += 4;
  
  for (const str of strings) {
    const strBytes = new TextEncoder().encode(str); // NEW ENCODER EACH TIME!
    view.setUint32(pos, strBytes.length, true);
    pos += 4;
    bytes.set(strBytes, pos);
    pos += strBytes.length;
  }
  
  return bytes;
}

function deserializeStringsOld(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  const decoder = new TextDecoder('utf-8'); // At least this is reused
  let pos = 0;
  
  const count = view.getUint32(pos, true);
  pos += 4;
  
  const strings: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const length = view.getUint32(pos, true);
    pos += 4;
    const strBytes = buffer.slice(pos, pos + length); // SLICE CREATES NEW ARRAY!
    const str = decoder.decode(strBytes); // DECODE EACH STRING SEPARATELY!
    strings.push(str);
    pos += length;
  }
  
  return strings;
}

// Optimized implementation
function serializeStringsOptimized(strings: string[]): Uint8Array {
  const encoder = new TextEncoder(); // REUSE ENCODER
  
  // Pre-encode all strings to calculate size
  const encodedStrings = strings.map(str => encoder.encode(str));
  const totalSize = 4 + encodedStrings.reduce((sum, bytes) => sum + 4 + bytes.length, 0);
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  let pos = 0;
  view.setUint32(pos, strings.length, true);
  pos += 4;
  
  for (const strBytes of encodedStrings) {
    view.setUint32(pos, strBytes.length, true);
    pos += 4;
    bytes.set(strBytes, pos);
    pos += strBytes.length;
  }
  
  return bytes;
}

function deserializeStringsOptimized(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  let pos = 0;
  
  const count = view.getUint32(pos, true);
  pos += 4;
  
  const strings: string[] = [];
  
  // DECODE ENTIRE BUFFER AT ONCE, THEN SPLIT
  const decoder = new TextDecoder('utf-8');
  
  for (let i = 0; i < count; i++) {
    const length = view.getUint32(pos, true);
    pos += 4;
    
    // Use subarray instead of slice (no copy)
    const strBytes = buffer.subarray(pos, pos + length);
    const str = decoder.decode(strBytes);
    strings.push(str);
    pos += length;
  }
  
  return strings;
}

// Ultra-optimized: decode entire buffer at once
function deserializeStringsUltra(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  let pos = 0;
  
  const count = view.getUint32(pos, true);
  pos += 4;
  
  // Collect all string boundaries first
  const boundaries: Array<{start: number, length: number}> = [];
  let dataStart = pos;
  
  for (let i = 0; i < count; i++) {
    const length = view.getUint32(pos, true);
    pos += 4;
    boundaries.push({start: pos, length});
    pos += length;
  }
  
  // Decode entire data section at once
  const decoder = new TextDecoder('utf-8');
  const allText = decoder.decode(buffer.subarray(dataStart + count * 4));
  
  // Extract strings by character positions (this gets complex...)
  // Actually, let's stick with the subarray approach for now
  
  const strings: string[] = [];
  for (const boundary of boundaries) {
    const strBytes = buffer.subarray(boundary.start, boundary.start + boundary.length);
    const str = decoder.decode(strBytes);
    strings.push(str);
  }
  
  return strings;
}

// Test the optimizations
function testOptimizations() {
  console.log("Length-Prefixed Optimization Test");
  console.log("=================================");
  
  // Generate test data
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const columns: string[] = [];
  
  for (let i = 0; i < 1000; i++) {
    const length = Math.floor(Math.random() * 20) + 1;
    let column = "";
    for (let j = 0; j < length; j++) {
      column += chars[Math.floor(Math.random() * chars.length)];
    }
    columns.push(column);
  }
  
  const iterations = 100;
  
  // Test old implementation
  console.log("\nOld Implementation:");
  const oldStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const serialized = serializeStringsOld(columns);
    const deserialized = deserializeStringsOld(serialized);
  }
  const oldEnd = performance.now();
  console.log(`Time: ${(oldEnd - oldStart).toFixed(2)}ms`);
  
  // Test optimized implementation
  console.log("\nOptimized Implementation:");
  const optStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const serialized = serializeStringsOptimized(columns);
    const deserialized = deserializeStringsOptimized(serialized);
  }
  const optEnd = performance.now();
  console.log(`Time: ${(optEnd - optStart).toFixed(2)}ms`);
  
  const speedup = (oldEnd - oldStart) / (optEnd - optStart);
  console.log(`Speedup: ${speedup.toFixed(2)}x`);
  
  // Verify correctness
  const original = serializeStringsOld(columns);
  const optimized = serializeStringsOptimized(columns);
  const originalParsed = deserializeStringsOld(original);
  const optimizedParsed = deserializeStringsOptimized(optimized);
  
  console.log(`Results match: ${JSON.stringify(originalParsed) === JSON.stringify(optimizedParsed)}`);
}

testOptimizations();
