#!/usr/bin/env -S deno run --allow-read

/**
 * Record→TSV Statistical Benchmark
 *
 * Compares TypeScript vs WASM implementations with statistical analysis.
 * Runs 10 warmup iterations followed by 100 benchmark iterations to measure
 * mean, median, standard deviation, min, and max throughput.
 */

import { enumerate } from "@j50n/proc";
import { Record2TsvWasmSimd } from "./record2tsv-wasm-simd.ts";
import { Record2TsvWasmSimdUnrolled } from "./record2tsv-wasm-simd-unrolled.ts";

// Load WASM modules once at startup
const wasmSimdTransformer = await Record2TsvWasmSimd.create();
const wasmSimdUnrolledTransformer = await Record2TsvWasmSimdUnrolled.create();

/**
 * TypeScript byte manipulation with validation.
 * Converts 0x1f→tab, 0x1e→newline, validates no tab/CR/LF in data.
 */
async function* typescriptBytesCorrect(
  source: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  let recordNum = 1;
  for await (const chunk of source) {
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === 0x1f) {
        chunk[i] = 0x09; // Field separator → tab
      } else if (chunk[i] === 0x1e) {
        chunk[i] = 0x0a; // Record separator → newline
        recordNum++;
      } else if (chunk[i] === 0x09 || chunk[i] === 0x0d || chunk[i] === 0x0a) {
        throw new Error(
          `Invalid character for TSV output in record ${recordNum.toLocaleString()}: 0x${
            chunk[i].toString(16).padStart(2, "0")
          }`,
        );
      }
    }
    yield chunk;
  }
}

/**
 * WASM SIMD approach (16 bytes at a time).
 */
async function* wasmSimd(
  source: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  for await (const chunk of source) {
    yield wasmSimdTransformer.transform(chunk);
  }
}

/**
 * WASM SIMD 4x unrolled (64 bytes per iteration).
 */
async function* wasmSimdUnrolled(
  source: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  for await (const chunk of source) {
    yield wasmSimdUnrolledTransformer.transform(chunk);
  }
}

const TEST_FILE = { name: "large", path: "data/large.record", size: 100 };
const WARMUP_RUNS = 10;
const BENCHMARK_RUNS = 100;

/**
 * Compute statistics from an array of numbers
 */
function computeStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const variance = values.reduce(
    (sum, val) => sum + Math.pow(val - mean, 2),
    0,
  ) / values.length;
  const stddev = Math.sqrt(variance);

  return { mean, median, stddev, min, max };
}

/**
 * Benchmark a transformation function.
 */
async function benchmark(
  transform: (source: AsyncIterable<Uint8Array>) => AsyncIterable<Uint8Array>,
  inputFile: string,
): Promise<number> {
  const file = await Deno.open(inputFile, { read: true });
  const start = performance.now();

  await enumerate(file.readable)
    .transform(transform)
    .forEach(() => {});

  return performance.now() - start;
}

console.log("Record→TSV Statistical Benchmark\n");
console.log(`Test file: ${TEST_FILE.size} MB`);
console.log(`Warmup: ${WARMUP_RUNS} runs`);
console.log(`Benchmark: ${BENCHMARK_RUNS} iterations\n`);

const approaches = [
  { name: "TypeScript (bytes-correct)", fn: typescriptBytesCorrect },
  { name: "WASM SIMD", fn: wasmSimd },
  { name: "WASM SIMD Unrolled", fn: wasmSimdUnrolled },
];

for (const approach of approaches) {
  console.log(`\n=== ${approach.name} ===`);

  // Warmup
  console.log("Warming up...");
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await benchmark(approach.fn, TEST_FILE.path);
  }

  // Benchmark
  console.log(`Running ${BENCHMARK_RUNS} iterations...`);
  const durations: number[] = [];
  for (let i = 0; i < BENCHMARK_RUNS; i++) {
    const duration = await benchmark(approach.fn, TEST_FILE.path);
    durations.push(duration);
    if ((i + 1) % 10 === 0) {
      console.info(`  Progress: ${i + 1}/${BENCHMARK_RUNS}`);
    }
  }

  // Compute throughputs and statistics
  const throughputs = durations.map((d) => TEST_FILE.size / (d / 1000));
  const stats = computeStats(throughputs);

  console.log("\nResults:");
  console.log(`  Mean:   ${stats.mean.toFixed(2)} MB/s`);
  console.log(`  Median: ${stats.median.toFixed(2)} MB/s`);
  console.log(`  StdDev: ${stats.stddev.toFixed(2)} MB/s`);
  console.log(`  Min:    ${stats.min.toFixed(2)} MB/s`);
  console.log(`  Max:    ${stats.max.toFixed(2)} MB/s`);
}

console.log("\n✓ Benchmark complete");
