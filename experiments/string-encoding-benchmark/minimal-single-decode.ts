#!/usr/bin/env -S deno run

// Current approach: start + length for each string
function serializeStringsSingleDecode(strings: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const allText = strings.join('');
  const textBytes = encoder.encode(allText);
  
  const indices: number[] = [strings.length]; // First: array size
  let charPos = 0;
  
  for (const str of strings) {
    indices.push(charPos);           // Start position
    indices.push(str.length);        // Character length
    charPos += str.length;
  }
  
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

function deserializeStringsSingleDecode(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  const count = view.getUint32(0, true);
  const indicesEnd = (1 + count * 2) * 4;
  
  const textBytes = buffer.subarray(indicesEnd);
  const allText = new TextDecoder('utf-8').decode(textBytes);
  
  const strings = new Array<string>(count);
  
  for (let i = 0; i < count; i++) {
    const startPos = view.getUint32((1 + i * 2) * 4, true);
    const length = view.getUint32((1 + i * 2 + 1) * 4, true);
    strings[i] = allText.substring(startPos, startPos + length);
  }
  
  return strings;
}

// Minimal approach: just start positions, calculate lengths
function serializeStringsMinimal(strings: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const allText = strings.join('');
  const textBytes = encoder.encode(allText);
  
  const indices: number[] = [strings.length]; // First: array size
  let charPos = 0;
  
  for (const str of strings) {
    indices.push(charPos);           // Just start position
    charPos += str.length;
  }
  indices.push(charPos); // Final position (total length)
  
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

function deserializeStringsMinimal(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  const count = view.getUint32(0, true);
  const indicesEnd = (1 + count + 1) * 4; // count + positions + final position
  
  const textBytes = buffer.subarray(indicesEnd);
  const allText = new TextDecoder('utf-8').decode(textBytes);
  
  const strings = new Array<string>(count);
  
  for (let i = 0; i < count; i++) {
    const startPos = view.getUint32((1 + i) * 4, true);
    const endPos = view.getUint32((1 + i + 1) * 4, true);
    strings[i] = allText.substring(startPos, endPos);
  }
  
  return strings;
}

// Test both approaches
function testMinimalApproach() {
  console.log("Single-Decode: Start+Length vs Start-Only Comparison");
  console.log("===================================================");
  
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
  
  // Test current approach (start + length)
  console.log("\nCurrent (Start + Length):");
  
  // Warmup
  for (let w = 0; w < 100; w++) {
    const serialized = serializeStringsSingleDecode(columns);
    deserializeStringsSingleDecode(serialized);
  }
  
  const currentStart = performance.now();
  let currentData: Uint8Array;
  for (let i = 0; i < iterations; i++) {
    currentData = serializeStringsSingleDecode(columns);
    const deserialized = deserializeStringsSingleDecode(currentData!);
  }
  const currentEnd = performance.now();
  
  console.log(`Time: ${(currentEnd - currentStart).toFixed(2)}ms`);
  console.log(`Per operation: ${((currentEnd - currentStart) / iterations).toFixed(3)}ms`);
  console.log(`Size: ${currentData!.length} bytes`);
  
  // Test minimal approach (start only)
  console.log("\nMinimal (Start Only):");
  
  // Warmup
  for (let w = 0; w < 100; w++) {
    const serialized = serializeStringsMinimal(columns);
    deserializeStringsMinimal(serialized);
  }
  
  const minimalStart = performance.now();
  let minimalData: Uint8Array;
  for (let i = 0; i < iterations; i++) {
    minimalData = serializeStringsMinimal(columns);
    const deserialized = deserializeStringsMinimal(minimalData!);
  }
  const minimalEnd = performance.now();
  
  console.log(`Time: ${(minimalEnd - minimalStart).toFixed(2)}ms`);
  console.log(`Per operation: ${((minimalEnd - minimalStart) / iterations).toFixed(3)}ms`);
  console.log(`Size: ${minimalData!.length} bytes`);
  
  // Compare
  const speedup = (currentEnd - currentStart) / (minimalEnd - minimalStart);
  const sizeReduction = currentData!.length - minimalData!.length;
  
  console.log("\nComparison:");
  if (speedup > 1) {
    console.log(`Minimal is ${speedup.toFixed(2)}x faster`);
  } else {
    console.log(`Current is ${(1/speedup).toFixed(2)}x faster`);
  }
  console.log(`Size reduction: ${sizeReduction} bytes (${((sizeReduction/currentData!.length)*100).toFixed(1)}%)`);
  
  // Verify correctness
  const currentResult = deserializeStringsSingleDecode(serializeStringsSingleDecode(columns));
  const minimalResult = deserializeStringsMinimal(serializeStringsMinimal(columns));
  const correct = JSON.stringify(currentResult) === JSON.stringify(minimalResult);
  console.log(`Results match: ${correct}`);
}

testMinimalApproach();
