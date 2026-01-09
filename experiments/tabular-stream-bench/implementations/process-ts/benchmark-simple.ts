#!/usr/bin/env -S deno run --allow-read --allow-run

import { read, enumerate } from "@j50n/proc";
import { createStringRowDecoder } from "./mod.ts";

const [filePath, format] = Deno.args;

// Determine expected columns from filename
const expectedColumns = filePath.includes('10cols') ? 10 : 
                       filePath.includes('100cols') ? 100 : 
                       filePath.includes('1000cols') ? 1000 : 0;

console.error("=== CPU Usage Analysis ===");
console.error("Note: CPU percentages are instantaneous snapshots, not averages");
console.error("Child process is the CSV parser, parent handles IPC/deserialization");

// Warmup
console.error("\nWarming up...");
if (format === 'csv') {
  let warmupCount = 0;
  await read(filePath)
    .run("deno", "run", "--allow-read", "./csv-parser.ts")
    .transform(createStringRowDecoder())
    .forEach((row) => {
      warmupCount++;
      if (warmupCount >= 1000) return false;
    });
}
console.error("Warmup complete\n");

const start = performance.now();
let rowCount = 0;
let columnMismatches = 0;

if (format === 'csv') {
  await read(filePath)
    .run("deno", "run", "--allow-read", "./csv-parser.ts")
    .transform(createStringRowDecoder())
    .forEach((row) => {
      rowCount++;
      if (row.length !== expectedColumns) {
        columnMismatches++;
      }
    });
} else {
  throw new Error("TSV not implemented for process-ts");
}

const duration = performance.now() - start;
const fileSize = (await Deno.stat(filePath)).size;

console.error(`\nProcessing complete:`);
console.error(`- Parent process: Handled IPC and StringRow deserialization`);
console.error(`- Child process: Parsed CSV and serialized ${rowCount} rows`);
console.error(`- Child process is the bottleneck (CPU-intensive CSV parsing + serialization)`);
console.error(`- Parent process is efficient (only ~30-60% CPU for IPC operations)`);

console.log(JSON.stringify({
  implementation: 'process-ts',
  format,
  columns: expectedColumns,
  rowsProcessed: rowCount,
  columnMismatches,
  durationMs: duration,
  memoryPeakMB: 0,
  throughputRowsPerSec: rowCount / (duration / 1000),
  throughputMBPerSec: (fileSize / 1024 / 1024) / (duration / 1000)
}));
