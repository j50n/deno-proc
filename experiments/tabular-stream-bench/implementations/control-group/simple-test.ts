#!/usr/bin/env -S deno run --allow-read

import { parse } from "jsr:@std/csv";

const [filePath, format] = Deno.args;

const start = performance.now();
let rowCount = 0;

if (format === 'csv') {
  const file = await Deno.open(filePath);
  for await (const row of readCSV(file)) {
    rowCount++;
  }
  file.close();
} else {
  // Simple TSV parser
  const text = await Deno.readTextFile(filePath);
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim()) {
      const values = line.split('\t');
      rowCount++;
    }
  }
}

const duration = performance.now() - start;
const fileSize = (await Deno.stat(filePath)).size;

console.log(JSON.stringify({
  implementation: 'baseline-js',
  format,
  columns: 0,
  rowsProcessed: rowCount,
  durationMs: duration,
  memoryPeakMB: 0,
  throughputRowsPerSec: rowCount / (duration / 1000),
  throughputMBPerSec: (fileSize / 1024 / 1024) / (duration / 1000)
}));
