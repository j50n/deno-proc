// Benchmark: string[][] → record format
// Compare: map+join+join vs array-push+single-join

const ROWS = 10000;
const COLS = 10;
const WARMUP = 100;
const ITERATIONS = 1000;
const FS = '\x1F';
const RS = '\x1E';
const FS_BYTES = new TextEncoder().encode(FS);
const RS_BYTES = new TextEncoder().encode(RS);
const encoder = new TextEncoder();

// Generate test data
const data: string[][] = Array.from({ length: ROWS }, (_, i) =>
  Array.from({ length: COLS }, (_, j) => `field_${i}_${j}`)
);

// Strategy 1: Current approach (map + join + join)
function mapJoinJoin(rows: string[][]): string {
  return rows.map(row => row.join(FS) + RS).join('');
}

// Strategy 2: Array push + single join
function arrayPushJoin(rows: string[][]): string {
  const parts: string[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) parts.push(FS);
      parts.push(row[i]);
    }
    parts.push(RS);
  }
  return parts.join('');
}

// Strategy 3: Pre-allocated array + single join
function preallocJoin(rows: string[][]): string {
  const size = rows.length * (rows[0].length * 2); // fields + separators
  const parts = new Array(size);
  let idx = 0;
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) parts[idx++] = FS;
      parts[idx++] = row[i];
    }
    parts[idx++] = RS;
  }
  return parts.join('');
}

// Strategy 4: String.concat()
function stringConcat(rows: string[][]): string {
  let result = '';
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) result = result.concat(FS);
      result = result.concat(row[i]);
    }
    result = result.concat(RS);
  }
  return result;
}

// Strategy 5: String.concat() with quick prealloc estimate
function stringConcatPrealloc(rows: string[][]): string {
  // Quick estimate: assume ~10 chars per field
  const estimatedSize = rows.length * rows[0].length * 11;
  let result = ' '.repeat(estimatedSize); // Pre-allocate string space
  result = ''; // Reset but keep capacity
  
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) result = result.concat(FS);
      result = result.concat(row[i]);
    }
    result = result.concat(RS);
  }
  return result;
}

// Warmup
for (let i = 0; i < WARMUP; i++) {
  mapJoinJoin(data);
  arrayPushJoin(data);
  preallocJoin(data);
  stringConcat(data);
  stringConcatPrealloc(data);
}

// Benchmark Strategy 1
const start1 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  mapJoinJoin(data);
}
const time1 = performance.now() - start1;

// Benchmark Strategy 2
const start2 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  arrayPushJoin(data);
}
const time2 = performance.now() - start2;

// Benchmark Strategy 3
const start3 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  preallocJoin(data);
}
const time3 = performance.now() - start3;

// Benchmark Strategy 4
const start4 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  stringConcat(data);
}
const time4 = performance.now() - start4;

// Benchmark Strategy 5
const start5 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  stringConcatPrealloc(data);
}
const time5 = performance.now() - start5;

// Calculate throughput
const result = mapJoinJoin(data);
const bytesPerIter = new TextEncoder().encode(result).length;
const mbPerSec1 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time1 / 1000);
const mbPerSec2 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time2 / 1000);
const mbPerSec3 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time3 / 1000);
const mbPerSec4 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time4 / 1000);
const mbPerSec5 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time5 / 1000);

console.log(`\nRows: ${ROWS}, Cols: ${COLS}, Iterations: ${ITERATIONS}\n`);
console.log(`Strategy 1 (map+join+join):     ${time1.toFixed(2)}ms → ${mbPerSec1.toFixed(1)} MB/s`);
console.log(`Strategy 2 (array+join):        ${time2.toFixed(2)}ms → ${mbPerSec2.toFixed(1)} MB/s`);
console.log(`Strategy 3 (prealloc+join):     ${time3.toFixed(2)}ms → ${mbPerSec3.toFixed(1)} MB/s`);
console.log(`Strategy 4 (string.concat):     ${time4.toFixed(2)}ms → ${mbPerSec4.toFixed(1)} MB/s`);
console.log(`Strategy 5 (concat+prealloc):   ${time5.toFixed(2)}ms → ${mbPerSec5.toFixed(1)} MB/s`);
console.log(`\nBest: Strategy ${[time1,time2,time3,time4,time5].indexOf(Math.min(time1,time2,time3,time4,time5)) + 1}`);
