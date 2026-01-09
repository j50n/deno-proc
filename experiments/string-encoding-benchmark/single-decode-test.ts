#!/usr/bin/env -S deno run

// Single-decode approach with character indices
function serializeStringsSingleDecode(strings: string[]): Uint8Array {
  const encoder = new TextEncoder();
  
  // Join all strings with no separator
  const allText = strings.join('');
  const textBytes = encoder.encode(allText);
  
  // Calculate character positions in the joined string
  const indices: number[] = [strings.length]; // First: array size
  let charPos = 0;
  
  for (const str of strings) {
    indices.push(charPos);           // Start position
    indices.push(str.length);        // Character length
    charPos += str.length;
  }
  
  // Create buffer: indices array + text data
  const indicesBytes = indices.length * 4; // 4 bytes per uint32
  const totalSize = indicesBytes + textBytes.length;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  // Write indices
  for (let i = 0; i < indices.length; i++) {
    view.setUint32(i * 4, indices[i], true);
  }
  
  // Write text data
  bytes.set(textBytes, indicesBytes);
  
  return bytes;
}

function deserializeStringsSingleDecode(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  
  // Read array size
  const count = view.getUint32(0, true);
  
  // Read all indices
  const indicesEnd = (1 + count * 2) * 4;
  
  // Decode entire text at once
  const textBytes = buffer.subarray(indicesEnd);
  const allText = new TextDecoder('utf-8').decode(textBytes);
  
  // Extract strings using character positions
  const strings = new Array<string>(count);
  
  for (let i = 0; i < count; i++) {
    const startPos = view.getUint32((1 + i * 2) * 4, true);
    const length = view.getUint32((1 + i * 2 + 1) * 4, true);
    strings[i] = allText.substring(startPos, startPos + length);
  }
  
  return strings;
}

// Test the single-decode approach
function testSingleDecode() {
  console.log("Single-Decode Optimization Test");
  console.log("===============================");
  
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
  
  // Warmup
  for (let w = 0; w < 100; w++) {
    const serialized = serializeStringsSingleDecode(columns);
    deserializeStringsSingleDecode(serialized);
  }
  
  // Test single-decode implementation
  console.log("\nSingle-Decode Implementation:");
  const start = performance.now();
  let serializedData: Uint8Array;
  for (let i = 0; i < iterations; i++) {
    serializedData = serializeStringsSingleDecode(columns);
    const deserialized = deserializeStringsSingleDecode(serializedData!);
  }
  const end = performance.now();
  console.log(`Time: ${(end - start).toFixed(2)}ms`);
  console.log(`Per operation: ${((end - start) / iterations).toFixed(3)}ms`);
  console.log(`Size: ${serializedData!.length} bytes`);
  
  // Verify correctness
  const roundTrip = deserializeStringsSingleDecode(serializeStringsSingleDecode(columns));
  const correct = JSON.stringify(columns) === JSON.stringify(roundTrip);
  console.log(`Correct: ${correct}`);
  
  // Compare with TSV for reference
  console.log("\nTSV Reference:");
  const tsvStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const tsvData = new TextEncoder().encode(columns.join('\t'));
    const tsvResult = new TextDecoder('utf-8').decode(tsvData).split('\t');
  }
  const tsvEnd = performance.now();
  console.log(`Time: ${(tsvEnd - tsvStart).toFixed(2)}ms`);
  console.log(`Per operation: ${((tsvEnd - tsvStart) / iterations).toFixed(3)}ms`);
  
  const speedup = (tsvEnd - tsvStart) / (end - start);
  if (speedup > 1) {
    console.log(`Single-decode is ${speedup.toFixed(2)}x faster than TSV!`);
  } else {
    console.log(`TSV is ${(1/speedup).toFixed(2)}x faster than single-decode`);
  }
}

testSingleDecode();
