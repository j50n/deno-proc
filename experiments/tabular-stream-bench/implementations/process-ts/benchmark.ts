#!/usr/bin/env -S deno run --allow-read --allow-run

import { read, enumerate } from "@j50n/proc";
import { createStringRowDecoder } from "./mod.ts";

const [filePath, format] = Deno.args;

// Determine expected columns from filename
const expectedColumns = filePath.includes('10cols') ? 10 : 
                       filePath.includes('100cols') ? 100 : 
                       filePath.includes('1000cols') ? 1000 : 0;

// Warmup - process a small sample first
console.error("Warming up...");
if (format === 'csv') {
  let warmupCount = 0;
  await read(filePath)
    .run("deno", "run", "--allow-read", "./csv-parser.ts")
    .transform(createStringRowDecoder())
    .forEach((row) => {
      warmupCount++;
      if (warmupCount >= 1000) return false; // Stop after 1000 rows
    });
}
console.error("Warmup complete");

const start = performance.now();
let rowCount = 0;
let columnMismatches = 0;

if (format === 'csv') {
  // Use out-of-process CSV parser with StringRow serialization
  await read(filePath)
    .run("deno", "run", "--allow-read", "./csv-parser.ts")
    .transform(createStringRowDecoder())
    .forEach((row) => {
      // Minimal processing - just count
      rowCount++;
      if (row.length !== expectedColumns) {
        columnMismatches++;
      }
    });
} else {
  // Skip TSV for now, just handle CSV
  console.error("TSV format not supported, skipping");
  Deno.exit(0);
}

const duration = performance.now() - start;
const fileSize = (await Deno.stat(filePath)).size;

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
