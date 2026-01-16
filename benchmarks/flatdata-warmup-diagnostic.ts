#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Warmup diagnostic - shows performance progression during warmup phase.
 */

import { FlatdataProcessor } from "../src/wasm/flatdata-processor.ts";

const TEMP_DIR = "/tmp/flatdata-bench";
const NUM_RECORDS = 100_000;
const NUM_COLUMNS = 20;
const WARMUP_ITERATIONS = 50;

async function generateTestData() {
  try {
    await Deno.mkdir(TEMP_DIR, { recursive: true });
  } catch {
    // Directory exists
  }

  const csvLines: string[] = [];
  for (let i = 0; i < NUM_RECORDS; i++) {
    const fields = Array.from(
      { length: NUM_COLUMNS },
      (_, j) => `field${j}_${i}`,
    );
    csvLines.push(fields.join(","));
  }
  const csvData = csvLines.join("\n") + "\n";
  await Deno.writeTextFile(`${TEMP_DIR}/test.csv`, csvData);

  const inputSize = (await Deno.stat(`${TEMP_DIR}/test.csv`)).size;
  console.log(`Test file: ${(inputSize / 1024 / 1024).toFixed(2)} MB\n`);
}

async function diagnosticWarmup() {
  await generateTestData();

  const processor = await FlatdataProcessor.create();
  const inputFile = `${TEMP_DIR}/test.csv`;
  const inputSize = (await Deno.stat(inputFile)).size;

  console.log("Warmup progression for csv2record:");
  console.log("Iter    Time(ms)  Throughput(MB/s)");
  console.log("========================================");

  const times: number[] = [];
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    const file = await Deno.open(inputFile, { read: true });
    const start = performance.now();
    let bytes = 0;
    for await (
      const chunk of processor.csvToRecordStreaming(file.readable, 44)
    ) {
      bytes += chunk.length;
    }
    const elapsed = performance.now() - start;
    times.push(elapsed);
    const throughput = (inputSize / 1024 / 1024) / (elapsed / 1000);
    console.log(
      `${(i + 1).toString().padStart(4)}    ${
        elapsed.toFixed(2).padStart(7)
      }  ${throughput.toFixed(1).padStart(8)}`,
    );
  }

  // Calculate rolling average
  console.log("\nRolling 5-iteration average:");
  for (let i = 4; i < times.length; i++) {
    const window = times.slice(i - 4, i + 1);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    const throughput = (inputSize / 1024 / 1024) / (avg / 1000);
    console.log(
      `Iterations ${i - 3}-${i + 1}: ${avg.toFixed(2)}ms (${
        throughput.toFixed(1)
      } MB/s)`,
    );
  }
}

async function cleanup() {
  try {
    await Deno.remove(TEMP_DIR, { recursive: true });
  } catch {
    // Ignore
  }
}

if (import.meta.main) {
  try {
    await diagnosticWarmup();
  } finally {
    await cleanup();
  }
}
