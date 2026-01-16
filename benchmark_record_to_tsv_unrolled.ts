#!/usr/bin/env -S deno run --allow-read
/**
 * Benchmark record-to-TSV conversion with 4x unrolled SIMD.
 * Compares performance before/after loop unrolling optimization.
 */

import { FlatdataProcessor } from "./src/wasm/flatdata-processor.ts";

const NUM_RECORDS = 100_000;
const NUM_COLUMNS = 20;
const ITERATIONS = 10;

// Generate test data in record format
function generateRecordData(): Uint8Array {
  const lines: string[] = [];
  for (let i = 0; i < NUM_RECORDS; i++) {
    const fields = Array.from(
      { length: NUM_COLUMNS },
      (_, j) => `field${j}_${i}`,
    );
    lines.push(fields.join("\x1F"));
  }
  return new TextEncoder().encode(lines.join("\x1E") + "\x1E");
}

async function benchmark() {
  console.log("Generating test data...");
  const recordData = generateRecordData();
  const sizeMB = recordData.length / 1024 / 1024;
  console.log(`  Size: ${sizeMB.toFixed(2)} MB`);
  console.log(`  Records: ${NUM_RECORDS.toLocaleString()}`);
  console.log(`  Columns: ${NUM_COLUMNS}`);
  console.log();

  console.log("Creating FlatdataProcessor...");
  const processor = await FlatdataProcessor.create();
  console.log();

  console.log(`Running benchmark (${ITERATIONS} iterations)...`);
  const times: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    
    // Convert record to TSV using SIMD-optimized function
    let outputSize = 0;
    for await (const chunk of processor.recordToTsvFast([recordData])) {
      outputSize += chunk.length;
    }
    
    const elapsed = performance.now() - start;
    times.push(elapsed);
    
    const throughput = sizeMB / (elapsed / 1000);
    console.log(
      `  Iteration ${i + 1}: ${elapsed.toFixed(2)}ms (${throughput.toFixed(2)} MB/s)`,
    );
  }

  console.log();
  console.log("Results:");
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  const avgThroughput = sizeMB / (avgTime / 1000);
  const maxThroughput = sizeMB / (minTime / 1000);
  
  console.log(`  Average: ${avgTime.toFixed(2)}ms (${avgThroughput.toFixed(2)} MB/s)`);
  console.log(`  Best:    ${minTime.toFixed(2)}ms (${maxThroughput.toFixed(2)} MB/s)`);
  console.log(`  Worst:   ${maxTime.toFixed(2)}ms (${(sizeMB / (maxTime / 1000)).toFixed(2)} MB/s)`);
}

benchmark();
