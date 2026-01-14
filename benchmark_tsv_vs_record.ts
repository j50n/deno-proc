#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Benchmark TSV vs Record conversions to/from LazyRow format
 */

import { run } from "./mod.ts";

// Generate 10MB of test data
function generateTestData(format: "tsv" | "record"): string {
  const rows: string[] = [];
  const targetSize = 10 * 1024 * 1024; // 10MB
  let currentSize = 0;
  
  const fieldSep = format === "tsv" ? "\t" : "\x1F";
  const recordSep = format === "tsv" ? "\n" : "\x1E";
  
  while (currentSize < targetSize) {
    const row = `field1_${rows.length}${fieldSep}field2_${rows.length}${fieldSep}field3_${rows.length}${fieldSep}field4_${rows.length}${fieldSep}field5_${rows.length}${recordSep}`;
    rows.push(row);
    currentSize += row.length;
  }
  
  return rows.join("");
}

async function benchmark(name: string, command: string[], inputFile: string, warmup: number = 3, runs: number = 5): Promise<number> {
  const fileSize = (await Deno.stat(inputFile)).size;
  const sizeInMB = fileSize / (1024 * 1024);
  
  // Warmup
  for (let i = 0; i < warmup; i++) {
    await run("deno", "run", "--allow-read", "--allow-write", "scripts/flatdata/flatdata.ts", ...command, "-i", inputFile, "-o", "/dev/null")
      .status;
  }
  
  // Actual runs
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await run("deno", "run", "--allow-read", "--allow-write", "scripts/flatdata/flatdata.ts", ...command, "-i", inputFile, "-o", "/dev/null")
      .status;
    const end = performance.now();
    times.push(end - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const throughput = (sizeInMB / (avgTime / 1000));
  
  console.log(`${name}:`);
  console.log(`  Avg time: ${avgTime.toFixed(2)}ms`);
  console.log(`  Throughput: ${throughput.toFixed(2)} MB/s`);
  console.log(`  Times: ${times.map(t => t.toFixed(2)).join(", ")}ms`);
  
  return throughput;
}

console.log("Generating test data...");
const tsvData = generateTestData("tsv");
const recordData = generateTestData("record");
console.log(`TSV data size: ${(tsvData.length / (1024 * 1024)).toFixed(2)} MB`);
console.log(`Record data size: ${(recordData.length / (1024 * 1024)).toFixed(2)} MB`);

// Write to temp files
await Deno.writeTextFile("/tmp/test.tsv", tsvData);
await Deno.writeTextFile("/tmp/test.rec", recordData);
console.log();

console.log("=== TSV → LazyRow (WASM) ===");
const tsvToLazyrow = await benchmark("tsv2lazyrow", ["tsv2lazyrow"], "/tmp/test.tsv");
console.log();

console.log("=== Record → LazyRow (Pure JS) ===");
const recordToLazyrow = await benchmark("record2lazyrow", ["record2lazyrow"], "/tmp/test.rec");
console.log();

// Now test the reverse direction
console.log("Converting to lazyrow for reverse tests...");
await run("deno", "run", "--allow-read", "--allow-write", "scripts/flatdata/flatdata.ts", "tsv2lazyrow", "-i", "/tmp/test.tsv", "-o", "/tmp/test_from_tsv.lazy").status;
await run("deno", "run", "--allow-read", "--allow-write", "scripts/flatdata/flatdata.ts", "record2lazyrow", "-i", "/tmp/test.rec", "-o", "/tmp/test_from_rec.lazy").status;
console.log();

console.log("=== LazyRow → TSV (WASM) ===");
const lazyrowToTsv = await benchmark("lazyrow2tsv", ["lazyrow2tsv"], "/tmp/test_from_tsv.lazy");
console.log();

console.log("=== LazyRow → Record (Pure JS) ===");
const lazyrowToRecord = await benchmark("lazyrow2record", ["lazyrow2record"], "/tmp/test_from_rec.lazy");
console.log();

console.log("=== SUMMARY ===");
console.log(`TSV → LazyRow (WASM):      ${tsvToLazyrow.toFixed(2)} MB/s`);
console.log(`Record → LazyRow (JS):     ${recordToLazyrow.toFixed(2)} MB/s`);
console.log(`Speedup: ${(recordToLazyrow / tsvToLazyrow).toFixed(2)}x`);
console.log();
console.log(`LazyRow → TSV (WASM):      ${lazyrowToTsv.toFixed(2)} MB/s`);
console.log(`LazyRow → Record (JS):     ${lazyrowToRecord.toFixed(2)} MB/s`);
console.log(`Speedup: ${(lazyrowToRecord / lazyrowToTsv).toFixed(2)}x`);
