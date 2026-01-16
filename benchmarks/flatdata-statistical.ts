#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Statistical benchmark for flatdata transformations.
 *
 * Tests transformation functions directly (not via subprocess) with:
 * - Warmup phase to allow VM optimization
 * - 100 measurement iterations
 * - Statistical analysis: mean, median, variance, quartiles
 */

import { enumerate } from "../mod.ts";
import { FlatdataProcessor } from "../src/wasm/flatdata-processor.ts";

const TEMP_DIR = "/tmp/flatdata-bench";
const NUM_RECORDS = 100_000;
const NUM_COLUMNS = 20;
const WARMUP_ITERATIONS = 30;
const MEASURE_ITERATIONS = 50;

async function generateTestData() {
  try {
    await Deno.mkdir(TEMP_DIR, { recursive: true });
  } catch {
    // Directory exists
  }

  console.log(
    `Generating test data: ${NUM_RECORDS} records × ${NUM_COLUMNS} columns...`,
  );

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

  const tsvData = csvData.replaceAll(",", "\t");
  await Deno.writeTextFile(`${TEMP_DIR}/test.tsv`, tsvData);

  const recordData = csvData.replaceAll(",", "\x1F").replaceAll("\n", "\x1E");
  await Deno.writeTextFile(`${TEMP_DIR}/test.rec`, recordData);

  const processor = await FlatdataProcessor.create();
  const csvFile = await Deno.open(`${TEMP_DIR}/test.csv`, { read: true });
  const lazyFile = await Deno.open(`${TEMP_DIR}/test.lazy`, {
    write: true,
    create: true,
    truncate: true,
  });
  await enumerate(csvFile.readable)
    .transform((input) => processor.csvToLazyRowBinaryStreaming(input, 44))
    .writeTo(lazyFile.writable);

  const csvSize = (await Deno.stat(`${TEMP_DIR}/test.csv`)).size;
  console.log(`  Test file size: ${(csvSize / 1024 / 1024).toFixed(2)} MB\n`);
}

function calculateStats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) /
    times.length;
  const stddev = Math.sqrt(variance);

  return {
    mean,
    median,
    q1,
    q3,
    variance,
    stddev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

async function benchmarkTransform(
  name: string,
  inputFile: string,
  transform: (
    processor: FlatdataProcessor,
    stream: ReadableStream<Uint8Array>,
  ) => AsyncIterable<Uint8Array>,
  forceScalar = false,
) {
  const processor = await FlatdataProcessor.create(forceScalar);
  const inputSize = (await Deno.stat(inputFile)).size;

  console.log(`\n${name}`);
  console.log("=".repeat(60));

  // Warmup
  console.log(`Warmup (${WARMUP_ITERATIONS} iterations)...`);
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    const file = await Deno.open(inputFile, { read: true });
    let bytes = 0;
    for await (const chunk of transform(processor, file.readable)) {
      bytes += chunk.length;
    }
    if (i % 10 === 0) console.log(`  Iteration ${i + 1}/${WARMUP_ITERATIONS}`);
  }

  // Measure
  console.log(`\nMeasuring (${MEASURE_ITERATIONS} iterations)...`);
  const times: number[] = [];
  for (let i = 0; i < MEASURE_ITERATIONS; i++) {
    const file = await Deno.open(inputFile, { read: true });
    const start = performance.now();
    let bytes = 0;
    for await (const chunk of transform(processor, file.readable)) {
      bytes += chunk.length;
    }
    const elapsed = performance.now() - start;
    times.push(elapsed);
    if (i % 25 === 0) console.log(`  Iteration ${i + 1}/${MEASURE_ITERATIONS}`);
  }

  const stats = calculateStats(times);
  const throughputMean = (inputSize / 1024 / 1024) / (stats.mean / 1000);
  const throughputMedian = (inputSize / 1024 / 1024) / (stats.median / 1000);

  console.log("\nResults:");
  console.log(`  Time (ms):`);
  console.log(`    Mean:     ${stats.mean.toFixed(2)}`);
  console.log(`    Median:   ${stats.median.toFixed(2)}`);
  console.log(`    Std Dev:  ${stats.stddev.toFixed(2)}`);
  console.log(`    Min:      ${stats.min.toFixed(2)}`);
  console.log(`    Max:      ${stats.max.toFixed(2)}`);
  console.log(`    Q1:       ${stats.q1.toFixed(2)}`);
  console.log(`    Q3:       ${stats.q3.toFixed(2)}`);
  console.log(`  Throughput (MB/s):`);
  console.log(`    Mean:     ${throughputMean.toFixed(1)}`);
  console.log(`    Median:   ${throughputMedian.toFixed(1)}`);

  return { name, stats, throughputMean, throughputMedian };
}

async function runBenchmarks() {
  await generateTestData();

  const results = [];

  // CSV conversions
  results.push(
    await benchmarkTransform(
      "csv2record",
      `${TEMP_DIR}/test.csv`,
      (p, s) => p.csvToRecordStreaming(s, 44),
    ),
  );

  results.push(
    await benchmarkTransform(
      "csv2lazyrow",
      `${TEMP_DIR}/test.csv`,
      (p, s) => p.csvToLazyRowBinaryStreaming(s, 44),
    ),
  );

  results.push(
    await benchmarkTransform(
      "csv2tsv",
      `${TEMP_DIR}/test.csv`,
      (p, s) => p.csvToTsvStreaming(s, 44),
    ),
  );

  // TSV conversions
  results.push(
    await benchmarkTransform(
      "tsv2record",
      `${TEMP_DIR}/test.tsv`,
      (p, s) => p.csvToRecordStreaming(s, 9),
    ),
  );

  results.push(
    await benchmarkTransform(
      "tsv2lazyrow",
      `${TEMP_DIR}/test.tsv`,
      (p, s) => p.csvToLazyRowBinaryStreaming(s, 9),
    ),
  );

  results.push(
    await benchmarkTransform(
      "tsv2csv",
      `${TEMP_DIR}/test.tsv`,
      (p, s) => p.tsvToCsvStreaming(s, 44),
    ),
  );

  // Record conversions
  results.push(
    await benchmarkTransform(
      "record2csv",
      `${TEMP_DIR}/test.rec`,
      (p, s) => p.recordToCsvStreaming(s, 44, false),
    ),
  );

  results.push(
    await benchmarkTransform(
      "record2tsv (SIMD)",
      `${TEMP_DIR}/test.rec`,
      (p, s) => p.recordToTsvFast(s),
      false, // Use SIMD
    ),
  );

  results.push(
    await benchmarkTransform(
      "record2tsv (scalar)",
      `${TEMP_DIR}/test.rec`,
      (p, s) => p.recordToTsvFast(s),
      true, // Force scalar
    ),
  );

  results.push(
    await benchmarkTransform(
      "record2lazyrow",
      `${TEMP_DIR}/test.rec`,
      (p, s) => p.recordToLazyRowBinaryStreaming(s),
    ),
  );

  // LazyRow conversions
  results.push(
    await benchmarkTransform(
      "lazyrow2csv",
      `${TEMP_DIR}/test.lazy`,
      (p, s) => p.lazyRowBinaryToDelimitedStreaming(s, 44),
    ),
  );

  results.push(
    await benchmarkTransform(
      "lazyrow2tsv",
      `${TEMP_DIR}/test.lazy`,
      (p, s) => p.lazyRowBinaryToDelimitedStreaming(s, 9),
    ),
  );

  results.push(
    await benchmarkTransform(
      "lazyrow2record",
      `${TEMP_DIR}/test.lazy`,
      (p, s) => p.lazyRowBinaryToRecordStreaming(s),
    ),
  );

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log("\nCommand              Throughput (MB/s)");
  console.log("                     Mean    Median");
  console.log("-".repeat(80));
  for (const r of results) {
    console.log(
      `${r.name.padEnd(20)} ${r.throughputMean.toFixed(1).padStart(6)}  ${
        r.throughputMedian.toFixed(1).padStart(6)
      }`,
    );
  }

  // Detailed statistics table
  console.log("\n" + "=".repeat(80));
  console.log("DETAILED STATISTICS");
  console.log("=".repeat(80));
  console.log(
    "\nCommand              Time (ms)                                    Throughput (MB/s)",
  );
  console.log(
    "                     Mean    Median  StdDev  Min     Max     Q1      Q3      Mean    Median",
  );
  console.log("-".repeat(80));
  for (const r of results) {
    const s = r.stats;
    console.log(
      `${r.name.padEnd(20)} ${s.mean.toFixed(1).padStart(6)}  ${
        s.median.toFixed(1).padStart(6)
      }  ${s.stddev.toFixed(1).padStart(6)}  ${s.min.toFixed(1).padStart(6)}  ${
        s.max.toFixed(1).padStart(6)
      }  ${s.q1.toFixed(1).padStart(6)}  ${s.q3.toFixed(1).padStart(6)}  ${
        r.throughputMean.toFixed(1).padStart(6)
      }  ${r.throughputMedian.toFixed(1).padStart(6)}`,
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
    await runBenchmarks();
  } finally {
    await cleanup();
  }
}
