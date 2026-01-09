#!/usr/bin/env -S deno run --allow-read

// Test different serialization approaches
const testRows: string[][] = [];
for (let i = 0; i < 1000; i++) {
  testRows.push([
    `col1_${i}`,
    `col2_${i}`,
    `col3_${i}`,
    `col4_${i}`,
    `col5_${i}`,
    `col6_${i}`,
    `col7_${i}`,
    `col8_${i}`,
    `col9_${i}`,
    `col10_${i}`
  ]);
}

const encoder = new TextEncoder();

console.log("=== Serialization Approach Comparison ===\n");

// Test 1: Just JSON.stringify
console.log("1. JSON.stringify:");
const start1 = performance.now();
for (const row of testRows) {
  const json = JSON.stringify(row);
  const bytes = encoder.encode(json);
}
const end1 = performance.now();
console.log(`   Time: ${(end1 - start1).toFixed(2)}ms`);
console.log(`   Rate: ${(testRows.length / ((end1 - start1) / 1000)).toFixed(0)} rows/sec\n`);

// Test 2: Simple delimited format
console.log("2. Simple delimited (\\t separated):");
const start2 = performance.now();
for (const row of testRows) {
  const delimited = row.join('\t');
  const bytes = encoder.encode(delimited);
}
const end2 = performance.now();
console.log(`   Time: ${(end2 - start2).toFixed(2)}ms`);
console.log(`   Rate: ${(testRows.length / ((end2 - start2) / 1000)).toFixed(0)} rows/sec\n`);

// Test 3: Length-prefixed strings (simpler than StringRow)
console.log("3. Length-prefixed strings:");
const start3 = performance.now();
for (const row of testRows) {
  const chunks: Uint8Array[] = [];
  
  // Write column count
  const countBytes = new Uint8Array(4);
  new DataView(countBytes.buffer).setUint32(0, row.length, true);
  chunks.push(countBytes);
  
  // Write each string with length prefix
  for (const col of row) {
    const colBytes = encoder.encode(col);
    const lengthBytes = new Uint8Array(4);
    new DataView(lengthBytes.buffer).setUint32(0, colBytes.length, true);
    chunks.push(lengthBytes);
    chunks.push(colBytes);
  }
}
const end3 = performance.now();
console.log(`   Time: ${(end3 - start3).toFixed(2)}ms`);
console.log(`   Rate: ${(testRows.length / ((end3 - start3) / 1000)).toFixed(0)} rows/sec\n`);

console.log("=== Relative Performance ===");
console.log(`JSON is ${((end1 - start1) / (end2 - start2)).toFixed(1)}x slower than delimited`);
console.log(`Length-prefixed is ${((end3 - start3) / (end2 - start2)).toFixed(1)}x slower than delimited`);
