// Benchmark to verify setField implementation doesn't degrade read-only performance
import { LazyRow } from "../../src/transforms/mod.ts";

const ROWS = 10000;
const COLS = 100;

// Generate test data
const testData = Array.from(
  { length: ROWS },
  (_, i) => Array.from({ length: COLS }, (_, j) => `field_${i}_${j}`),
);

console.log("LazyRow setField Performance Impact");
console.log("====================================");
console.log(
  `Dataset: ${ROWS} rows × ${COLS} columns = ${ROWS * COLS} fields\n`,
);

// Test 1: Binary LazyRow - Read-only (common case)
console.log("Test 1: Binary LazyRow - Read-only (no modifications)");
const binaryRows = testData.map((row) =>
  LazyRow.fromBinary(LazyRow.fromStringArray(row).toBinary())
);

let start = performance.now();
let sum = 0;
for (const row of binaryRows) {
  // Simulate checking 5 columns per row (your use case)
  sum += row.getField(0).length;
  sum += row.getField(25).length;
  sum += row.getField(50).length;
  sum += row.getField(75).length;
  sum += row.getField(99).length;
}
let end = performance.now();
const readOnlyTime = end - start;
console.log(`Time: ${readOnlyTime.toFixed(2)}ms`);
console.log(`Field accesses: ${ROWS * 5}`);
console.log(
  `Accesses/sec: ${((ROWS * 5) / (readOnlyTime / 1000)).toLocaleString()}\n`,
);

// Test 2: Binary LazyRow - Sparse modifications (10K modifications out of 1M fields)
console.log("Test 2: Binary LazyRow - Sparse modifications (0.01% modified)");
const modifiedRows = testData.map((row) =>
  LazyRow.fromBinary(LazyRow.fromStringArray(row).toBinary())
);

// Modify ~10 fields total (simulating 10K out of 200M in your use case)
for (let i = 0; i < 10; i++) {
  modifiedRows[i * 1000].setField(50, "MODIFIED");
}

start = performance.now();
sum = 0;
for (const row of modifiedRows) {
  sum += row.getField(0).length;
  sum += row.getField(25).length;
  sum += row.getField(50).length;
  sum += row.getField(75).length;
  sum += row.getField(99).length;
}
end = performance.now();
const modifiedTime = end - start;
console.log(`Time: ${modifiedTime.toFixed(2)}ms`);
console.log(`Field accesses: ${ROWS * 5}`);
console.log(
  `Accesses/sec: ${((ROWS * 5) / (modifiedTime / 1000)).toLocaleString()}`,
);
console.log(
  `Overhead vs read-only: ${
    ((modifiedTime / readOnlyTime - 1) * 100).toFixed(2)
  }%\n`,
);

// Test 3: toBinary fast path (no modifications)
console.log("Test 3: toBinary fast path (no modifications)");
const cleanRows = testData.map((row) =>
  LazyRow.fromBinary(LazyRow.fromStringArray(row).toBinary())
);

start = performance.now();
for (const row of cleanRows) {
  row.toBinary();
}
end = performance.now();
const toBinaryCleanTime = end - start;
console.log(`Time: ${toBinaryCleanTime.toFixed(2)}ms`);
console.log(
  `Rows/sec: ${(ROWS / (toBinaryCleanTime / 1000)).toLocaleString()}\n`,
);

// Test 4: toBinary with modifications
console.log("Test 4: toBinary with modifications (all rows modified)");
const dirtyRows = testData.map((row) =>
  LazyRow.fromBinary(LazyRow.fromStringArray(row).toBinary())
);

for (const row of dirtyRows) {
  row.setField(50, "MODIFIED");
}

start = performance.now();
for (const row of dirtyRows) {
  row.toBinary();
}
end = performance.now();
const toBinaryDirtyTime = end - start;
console.log(`Time: ${toBinaryDirtyTime.toFixed(2)}ms`);
console.log(
  `Rows/sec: ${(ROWS / (toBinaryDirtyTime / 1000)).toLocaleString()}`,
);
console.log(
  `Slowdown vs clean: ${(toBinaryDirtyTime / toBinaryCleanTime).toFixed(2)}x\n`,
);

console.log("Summary");
console.log("=======");
console.log(
  `Read-only performance: ${
    ((ROWS * 5) / (readOnlyTime / 1000) / 1_000_000).toFixed(1)
  }M accesses/sec`,
);
console.log(
  `Sparse modification overhead: ${
    ((modifiedTime / readOnlyTime - 1) * 100).toFixed(2)
  }%`,
);
console.log(
  `toBinary fast path: ${
    (ROWS / (toBinaryCleanTime / 1000) / 1_000).toFixed(0)
  }K rows/sec`,
);
