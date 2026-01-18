// Benchmark: TextEncoder.encode() vs bound encode function

const ROWS = 10000;
const COLS = 10;
const ITERATIONS = 100;
const WARMUP_ITERATIONS = 100;

// Generate test data
const testData: string[][] = [];
for (let i = 0; i < ROWS; i++) {
  const row: string[] = [];
  for (let j = 0; j < COLS; j++) {
    row.push(`field_${i}_${j}`);
  }
  testData.push(row);
}

// Build a large string to encode
function buildString(rows: string[][]): string {
  let result = "";
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) result = result.concat("\t");
      result = result.concat(row[i]);
    }
    result = result.concat("\n");
  }
  return result;
}

const testString = buildString(testData);
const stringBytes = testString.length;

console.log(`\nString: ${stringBytes.toLocaleString()} bytes, Warmup: ${WARMUP_ITERATIONS}, Iterations: ${ITERATIONS}\n`);

// Strategy 1: Direct encoder.encode()
function strategy1(): number {
  const encoder = new TextEncoder();
  let totalBytes = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const bytes = encoder.encode(testString);
    totalBytes += bytes.length;
  }
  return totalBytes;
}

// Strategy 2: Bound encode function
function strategy2(): number {
  const encoder = new TextEncoder();
  const encode = encoder.encode.bind(encoder);
  let totalBytes = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const bytes = encode(testString);
    totalBytes += bytes.length;
  }
  return totalBytes;
}

// Strategy 3: IIFE-bound encode (pattern from codebase)
function strategy3(): number {
  const encode = (() => {
    const encoder = new TextEncoder();
    return encoder.encode.bind(encoder);
  })();
  let totalBytes = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const bytes = encode(testString);
    totalBytes += bytes.length;
  }
  return totalBytes;
}

// Warmup
console.log("Warming up...");
for (let i = 0; i < WARMUP_ITERATIONS; i++) {
  strategy1();
  strategy2();
  strategy3();
}
console.log("Warmup complete.\n");

// Benchmark
const start1 = performance.now();
const bytes1 = strategy1();
const time1 = performance.now() - start1;

const start2 = performance.now();
const bytes2 = strategy2();
const time2 = performance.now() - start2;

const start3 = performance.now();
const bytes3 = strategy3();
const time3 = performance.now() - start3;

const throughput1 = (bytes1 / 1024 / 1024) / (time1 / 1000);
const throughput2 = (bytes2 / 1024 / 1024) / (time2 / 1000);
const throughput3 = (bytes3 / 1024 / 1024) / (time3 / 1000);

console.log(`Strategy 1 (encoder.encode):  ${time1.toFixed(2)}ms → ${throughput1.toFixed(1)} MB/s`);
console.log(`Strategy 2 (bound encode):    ${time2.toFixed(2)}ms → ${throughput2.toFixed(1)} MB/s`);
console.log(`Strategy 3 (IIFE bound):      ${time3.toFixed(2)}ms → ${throughput3.toFixed(1)} MB/s`);

const best = Math.max(throughput1, throughput2, throughput3);
const bestStrategy = best === throughput1 ? "Strategy 1" : best === throughput2 ? "Strategy 2" : "Strategy 3";
console.log(`\nBest: ${bestStrategy}`);
