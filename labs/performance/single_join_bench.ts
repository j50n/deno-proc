// Benchmark: single join vs string.concat for simple field joining

const ROWS = 10000;
const COLS = 10;
const WARMUP = 100;
const ITERATIONS = 1000;

// Generate test data
const data: string[][] = Array.from({ length: ROWS }, (_, i) =>
  Array.from({ length: COLS }, (_, j) => `field_${i}_${j}`)
);

// Strategy 1: Array.join() for fields
function arrayJoin(rows: string[][]): string {
  let result = '';
  for (const row of rows) {
    result += row.join('\x1F') + '\x1E';
  }
  return result;
}

// Strategy 2: String.concat() for each field
function stringConcat(rows: string[][]): string {
  let result = '';
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) result = result.concat('\x1F');
      result = result.concat(row[i]);
    }
    result = result.concat('\x1E');
  }
  return result;
}

// Strategy 3: Build array, then single join
function arrayThenConcat(rows: string[][]): string {
  const parts: string[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) parts.push('\x1F');
      parts.push(row[i]);
    }
    parts.push('\x1E');
  }
  return parts.join('');
}

// Warmup
for (let i = 0; i < WARMUP; i++) {
  arrayJoin(data);
  stringConcat(data);
  arrayThenConcat(data);
}

// Benchmark Strategy 1
const start1 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  arrayJoin(data);
}
const time1 = performance.now() - start1;

// Benchmark Strategy 2
const start2 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  stringConcat(data);
}
const time2 = performance.now() - start2;

// Benchmark Strategy 3
const start3 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  arrayThenConcat(data);
}
const time3 = performance.now() - start3;

// Calculate throughput
const result = arrayJoin(data);
const bytesPerIter = new TextEncoder().encode(result).length;
const mbPerSec1 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time1 / 1000);
const mbPerSec2 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time2 / 1000);
const mbPerSec3 = (bytesPerIter * ITERATIONS / 1024 / 1024) / (time3 / 1000);

console.log(`\nRows: ${ROWS}, Cols: ${COLS}, Iterations: ${ITERATIONS}\n`);
console.log(`Strategy 1 (join+concat):     ${time1.toFixed(2)}ms → ${mbPerSec1.toFixed(1)} MB/s`);
console.log(`Strategy 2 (concat only):     ${time2.toFixed(2)}ms → ${mbPerSec2.toFixed(1)} MB/s`);
console.log(`Strategy 3 (array+concat):    ${time3.toFixed(2)}ms → ${mbPerSec3.toFixed(1)} MB/s`);
console.log(`\nBest: Strategy ${[time1,time2,time3].indexOf(Math.min(time1,time2,time3)) + 1}`);
