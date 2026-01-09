#!/usr/bin/env -S deno run --allow-read

import { StringRow } from "../../src/data-transform/string-row.ts";

// Create test data - 10 columns, 1000 rows
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

console.log(`Testing serialization of ${testRows.length} rows with ${testRows[0].length} columns each`);

// Warmup - run each test once to JIT compile
console.log("\n=== Warmup ===");
for (const row of testRows.slice(0, 100)) {
  StringRow.fromArray(row).toBytes();
}

const encoder = new TextEncoder();
for (const row of testRows.slice(0, 100)) {
  const text = row.join('');
  encoder.encode(text);
}

console.log("Warmup complete");

// Test 1: Individual row serialization (current approach)
console.log("\n=== Test 1: Individual Row Serialization ===");
const start1 = performance.now();
const serializedRows: Uint8Array[] = [];

for (const row of testRows) {
  const stringRowBytes = StringRow.fromArray(row).toBytes();
  serializedRows.push(stringRowBytes);
}

const end1 = performance.now();
const totalBytes1 = serializedRows.reduce((sum, bytes) => sum + bytes.length, 0);

console.log(`Time: ${(end1 - start1).toFixed(2)}ms`);
console.log(`Total bytes: ${totalBytes1}`);
console.log(`Rate: ${(testRows.length / ((end1 - start1) / 1000)).toFixed(0)} rows/sec`);

// Test 2: Just the TextEncoder overhead
console.log("\n=== Test 2: Just TextEncoder Overhead ===");
const start2 = performance.now();

for (const row of testRows) {
  const text = row.join('');
  const bytes = encoder.encode(text);
}

const end2 = performance.now();
console.log(`Time: ${(end2 - start2).toFixed(2)}ms`);
console.log(`Rate: ${(testRows.length / ((end2 - start2) / 1000)).toFixed(0)} rows/sec`);

// Test 3: Reused TextEncoder
console.log("\n=== Test 3: Reused TextEncoder (baseline) ===");
const start3 = performance.now();
const sharedEncoder = new TextEncoder();

for (const row of testRows) {
  const text = row.join('');
  const bytes = sharedEncoder.encode(text);
}

const end3 = performance.now();
console.log(`Time: ${(end3 - start3).toFixed(2)}ms`);
console.log(`Rate: ${(testRows.length / ((end3 - start3) / 1000)).toFixed(0)} rows/sec`);

console.log(`\nSerializationOverhead: ${((end1 - start1) / (end3 - start3)).toFixed(1)}x slower than baseline`);
