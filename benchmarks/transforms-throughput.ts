#!/usr/bin/env -S deno run --allow-read
/**
 * Benchmark throughput of all in-process transforms.
 *
 * Tests: CSV, TSV, Record, JSON, LazyRow binary, csv-fast (WASM)
 * Data: 100,000 records × 20 columns (~10MB)
 */

import {
  fromCsvToLazyRows,
  fromCsvToLazyRowsFast,
  fromCsvToRows,
  fromCsvToRowsFast,
  fromJsonToRows,
  fromLazyRowBinary,
  fromRecordToLazyRows,
  fromRecordToRows,
  fromTsvToLazyRows,
  fromTsvToRows,
  LazyRow,
  toCsv,
  toCsvFast,
  toJson,
  toLazyRowBinary,
  toRecord,
  toTsv,
} from "../src/transforms/mod.ts";

const NUM_RECORDS = 100_000;
const NUM_COLUMNS = 20;

// Generate test data
function generateRows(): string[][] {
  return Array.from(
    { length: NUM_RECORDS },
    (_, i) => Array.from({ length: NUM_COLUMNS }, (_, j) => `field${j}_${i}`),
  );
}

function generateCsv(rows: string[][]): string {
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

function generateTsv(rows: string[][]): string {
  return rows.map((r) => r.join("\t")).join("\n") + "\n";
}

function generateRecord(rows: string[][]): string {
  return rows.map((r) => r.join("\x1F")).join("\x1E");
}

function generateJsonLines(rows: string[][]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

async function* toAsync<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function* bytesFrom(data: string): AsyncIterable<Uint8Array> {
  yield new TextEncoder().encode(data);
}

async function drain<T>(iter: AsyncIterable<T>): Promise<number> {
  let count = 0;
  for await (const batch of iter) {
    count += Array.isArray(batch) ? batch.length : 1;
  }
  return count;
}

async function drainBytes(iter: AsyncIterable<Uint8Array>): Promise<number> {
  let size = 0;
  for await (const chunk of iter) size += chunk.length;
  return size;
}

interface BenchResult {
  name: string;
  throughput: number;
  time: number;
}

async function bench(
  name: string,
  sizeMB: number,
  fn: () => Promise<void>,
): Promise<BenchResult> {
  const start = performance.now();
  await fn();
  const time = (performance.now() - start) / 1000;
  const throughput = sizeMB / time;
  return { name, throughput, time };
}

async function main() {
  console.log(
    `Generating test data: ${NUM_RECORDS} records × ${NUM_COLUMNS} columns...\n`,
  );

  const rows = generateRows();
  const csvData = generateCsv(rows);
  const tsvData = generateTsv(rows);
  const recData = generateRecord(rows);
  const jsonData = generateJsonLines(rows);

  const csvSize = new TextEncoder().encode(csvData).length / 1024 / 1024;
  const tsvSize = new TextEncoder().encode(tsvData).length / 1024 / 1024;
  const recSize = new TextEncoder().encode(recData).length / 1024 / 1024;
  const jsonSize = new TextEncoder().encode(jsonData).length / 1024 / 1024;

  console.log(`  CSV:    ${csvSize.toFixed(2)} MB`);
  console.log(`  TSV:    ${tsvSize.toFixed(2)} MB`);
  console.log(`  Record: ${recSize.toFixed(2)} MB`);
  console.log(`  JSON:   ${jsonSize.toFixed(2)} MB\n`);

  // Pre-generate binary lazyrow data
  const lazyRows = rows.map((r) => LazyRow.fromStringArray(r));
  const binaryChunks: Uint8Array[] = [];
  for await (const chunk of toLazyRowBinary()(toAsync([lazyRows]))) {
    binaryChunks.push(chunk);
  }
  const binaryData = new Uint8Array(
    binaryChunks.reduce((s, c) => s + c.length, 0),
  );
  let pos = 0;
  for (const c of binaryChunks) {
    binaryData.set(c, pos);
    pos += c.length;
  }
  const binarySize = binaryData.length / 1024 / 1024;
  console.log(`  Binary: ${binarySize.toFixed(2)} MB\n`);

  const results: BenchResult[] = [];

  // CSV benchmarks
  console.log("CSV transforms:");
  results.push(
    await bench("fromCsvToRows", csvSize, async () => {
      await drain(fromCsvToRows()(bytesFrom(csvData)));
    }),
  );
  results.push(
    await bench("fromCsvToLazyRows", csvSize, async () => {
      await drain(fromCsvToLazyRows()(bytesFrom(csvData)));
    }),
  );
  results.push(
    await bench("toCsv", csvSize, async () => {
      await drainBytes(toCsv()(fromCsvToRows()(bytesFrom(csvData))));
    }),
  );

  // TSV benchmarks
  console.log("\nTSV transforms:");
  results.push(
    await bench("fromTsvToRows", tsvSize, async () => {
      await drain(fromTsvToRows()(bytesFrom(tsvData)));
    }),
  );
  results.push(
    await bench("fromTsvToLazyRows", tsvSize, async () => {
      await drain(fromTsvToLazyRows()(bytesFrom(tsvData)));
    }),
  );
  results.push(
    await bench("toTsv", tsvSize, async () => {
      await drainBytes(toTsv()(fromTsvToRows()(bytesFrom(tsvData))));
    }),
  );

  // Record benchmarks
  console.log("\nRecord transforms:");
  results.push(
    await bench("fromRecordToRows", recSize, async () => {
      await drain(fromRecordToRows()(bytesFrom(recData)));
    }),
  );
  results.push(
    await bench("fromRecordToLazyRows", recSize, async () => {
      await drain(fromRecordToLazyRows()(bytesFrom(recData)));
    }),
  );
  results.push(
    await bench("toRecord", recSize, async () => {
      await drainBytes(toRecord()(fromRecordToRows()(bytesFrom(recData))));
    }),
  );

  // JSON benchmarks
  console.log("\nJSON transforms:");
  results.push(
    await bench("fromJsonToRows", jsonSize, async () => {
      await drain(fromJsonToRows()(bytesFrom(jsonData)));
    }),
  );
  results.push(
    await bench("toJson", jsonSize, async () => {
      await drainBytes(toJson()(fromJsonToRows()(bytesFrom(jsonData))));
    }),
  );

  // LazyRow binary benchmarks
  console.log("\nLazyRow binary transforms:");
  results.push(
    await bench("fromLazyRowBinary", binarySize, async () => {
      await drain(fromLazyRowBinary()(toAsync([binaryData])));
    }),
  );
  results.push(
    await bench("toLazyRowBinary", binarySize, async () => {
      await drainBytes(toLazyRowBinary()(toAsync([lazyRows])));
    }),
  );

  // csv-fast WASM benchmarks
  console.log("\ncsv-fast (WASM) transforms:");
  try {
    results.push(
      await bench("fromCsvToRowsFast", csvSize, async () => {
        await drain(fromCsvToRowsFast()(bytesFrom(csvData)));
      }),
    );
    results.push(
      await bench("fromCsvToLazyRowsFast", csvSize, async () => {
        await drain(fromCsvToLazyRowsFast()(bytesFrom(csvData)));
      }),
    );
    results.push(
      await bench("toCsvFast", csvSize, async () => {
        await drainBytes(toCsvFast()(fromCsvToRowsFast()(bytesFrom(csvData))));
      }),
    );
  } catch (_e) {
    console.log("  (skipped - WASM memory limit exceeded for this data size)");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));
  console.log(
    `${"Transform".padEnd(25)} ${"MB/s".padStart(10)} ${"Time".padStart(10)}`,
  );
  console.log("-".repeat(50));
  for (const r of results) {
    console.log(
      `${r.name.padEnd(25)} ${r.throughput.toFixed(1).padStart(10)} ${
        (r.time * 1000).toFixed(0).padStart(7)
      } ms`,
    );
  }

  const avg = results.reduce((s, r) => s + r.throughput, 0) / results.length;
  console.log("-".repeat(50));
  console.log(`${"Average".padEnd(25)} ${avg.toFixed(1).padStart(10)} MB/s`);
}

main();
