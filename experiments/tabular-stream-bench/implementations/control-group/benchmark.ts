#!/usr/bin/env -S deno run --allow-read

import { parse } from "@std/csv";
import { read } from "@j50n/proc";
import { createTSVParser } from "./mod.ts";

const [filePath, format] = Deno.args;

// Determine expected columns from filename
const expectedColumns = filePath.includes('10cols') ? 10 : 
                       filePath.includes('100cols') ? 100 : 
                       filePath.includes('1000cols') ? 1000 : 0;

const start = performance.now();
let rowCount = 0;
let columnMismatches = 0;

if (format === 'csv') {
  // Use Deno's CSV parser on the full file content
  const content = await Deno.readTextFile(filePath);
  const rows = parse(content);
  // Verify each row has expected columns
  for (const row of rows) {
    if (Array.isArray(row)) {
      rowCount++;
      if (row.length !== expectedColumns) {
        columnMismatches++;
      }
    }
  }
} else {
  // Use proc's streaming with chunked lines for TSV
  await read(filePath)
    .chunkedLines
    .transform(createTSVParser())
    .forEach((row) => {
      // Verify row has expected columns
      if (Array.isArray(row)) {
        rowCount++;
        if (row.length !== expectedColumns) {
          columnMismatches++;
        }
      }
    });
}

const duration = performance.now() - start;
const fileSize = (await Deno.stat(filePath)).size;

console.log(JSON.stringify({
  implementation: 'baseline-js',
  format,
  columns: expectedColumns,
  rowsProcessed: rowCount,
  columnMismatches,
  durationMs: duration,
  memoryPeakMB: 0,
  throughputRowsPerSec: rowCount / (duration / 1000),
  throughputMBPerSec: (fileSize / 1024 / 1024) / (duration / 1000)
}));
