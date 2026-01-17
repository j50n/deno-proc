#!/usr/bin/env -S deno run --allow-read
/**
 * Transform Throughput Benchmark
 *
 * Measures throughput (MB/s) of all in-process transforms.
 * Tests: CSV, TSV, Record, JSON, LazyRow binary
 * Data: 100,000 records × 20 columns (~25MB)
 */

import {
  fromCsvToLazyRows,
  fromCsvToRows,
  fromJsonToRows,
  fromLazyRowBinary,
  fromRecordToLazyRows,
  fromRecordToRows,
  fromTsvToLazyRows,
  fromTsvToRows,
  LazyRow,
  toCsv,
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

async function* _flattenRows<T>(
  iter: AsyncIterable<T[] | T>,
): AsyncIterable<T> {
  for await (const item of iter) {
    if (Array.isArray(item)) {
      for (const row of item) yield row;
    } else {
      yield item;
    }
  }
}

async function* _toStringBackedLazyRows(
  iter: AsyncIterable<string[][]>,
): AsyncIterable<LazyRow[]> {
  for await (const batch of iter) {
    yield batch.map((row) => LazyRow.fromStringArray(row));
  }
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

async function benchToCsv(
  name: string,
  dataGen: () => AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
  sizeMB: number,
): Promise<BenchResult> {
  // Warmup
  await drainBytes(toCsv()(dataGen()));

  // Measure
  const start = performance.now();
  await drainBytes(toCsv()(dataGen()));
  const time = (performance.now() - start) / 1000;
  return { name, throughput: sizeMB / time, time };
}

async function benchToTsv(
  name: string,
  dataGen: () => AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
  sizeMB: number,
): Promise<BenchResult> {
  await drainBytes(toTsv()(dataGen()));
  const start = performance.now();
  await drainBytes(toTsv()(dataGen()));
  const time = (performance.now() - start) / 1000;
  return { name, throughput: sizeMB / time, time };
}

async function benchToRecord(
  name: string,
  dataGen: () => AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
  sizeMB: number,
): Promise<BenchResult> {
  await drainBytes(toRecord()(dataGen()));
  const start = performance.now();
  await drainBytes(toRecord()(dataGen()));
  const time = (performance.now() - start) / 1000;
  return { name, throughput: sizeMB / time, time };
}

async function benchToLazyRowBinary(
  name: string,
  dataGen: () => AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
  sizeMB: number,
): Promise<BenchResult> {
  await drainBytes(toLazyRowBinary()(dataGen()));
  const start = performance.now();
  await drainBytes(toLazyRowBinary()(dataGen()));
  const time = (performance.now() - start) / 1000;
  return { name, throughput: sizeMB / time, time };
}

async function main() {
  const rows = generateRows();

  // Calculate all sizes upfront
  const csvData = generateCsv(rows);
  const tsvData = generateTsv(rows);
  const recData = generateRecord(rows);
  const jsonData = generateJsonLines(rows);

  const csvSize = new TextEncoder().encode(csvData).length / 1024 / 1024;
  const tsvSize = new TextEncoder().encode(tsvData).length / 1024 / 1024;
  const recSize = new TextEncoder().encode(recData).length / 1024 / 1024;
  const jsonSize = new TextEncoder().encode(jsonData).length / 1024 / 1024;

  // Pre-generate binary lazyrow data for toLazyRowBinary benchmarks
  const lazyRows = rows.map((r) => LazyRow.fromStringArray(r));
  const binaryChunks: Uint8Array[] = [];
  // Process in batches to avoid huge WASM buffer allocation
  const lazyRowBatches: LazyRow[][] = [];
  for (let i = 0; i < lazyRows.length; i += 1000) {
    lazyRowBatches.push(lazyRows.slice(i, i + 1000));
  }
  for await (const chunk of toLazyRowBinary()(toAsync(lazyRowBatches))) {
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

  // Pre-generate actual binary-backed LazyRows for benchmarking
  const actualBinaryLazyRows: LazyRow[] = [];
  for await (const batch of fromLazyRowBinary()(toAsync([binaryData]))) {
    actualBinaryLazyRows.push(...batch);
  }

  // Create batches of binary-backed LazyRows
  const actualBinaryLazyRowBatches: LazyRow[][] = [];
  for (let i = 0; i < actualBinaryLazyRows.length; i += 1000) {
    actualBinaryLazyRowBatches.push(actualBinaryLazyRows.slice(i, i + 1000));
  }

  const results: BenchResult[] = [];

  // toCsv (from string[][])
  const batches: string[][][] = [];
  for (let i = 0; i < rows.length; i += 1000) {
    batches.push(rows.slice(i, i + 1000));
  }
  results.push(
    await benchToCsv(
      "toCsv (from string[][])",
      () => toAsync(batches),
      csvSize,
    ),
  );

  // toCsv (from string[])
  results.push(
    await benchToCsv("toCsv (from string[])", () => toAsync(rows), csvSize),
  );

  // toCsv (from LazyRow[] binary)
  results.push(
    await benchToCsv(
      "toCsv (from LazyRow[] binary)",
      () => toAsync(actualBinaryLazyRowBatches),
      csvSize,
    ),
  );

  // toCsv (from LazyRow binary)
  results.push(
    await benchToCsv(
      "toCsv (from LazyRow binary)",
      () => toAsync(actualBinaryLazyRows),
      csvSize,
    ),
  );

  // toCsv (from LazyRow[] string)
  const stringLazyRowBatches: LazyRow[][] = [];
  for (let i = 0; i < rows.length; i += 1000) {
    stringLazyRowBatches.push(
      rows.slice(i, i + 1000).map((r) => LazyRow.fromStringArray(r)),
    );
  }
  results.push(
    await benchToCsv(
      "toCsv (from LazyRow[] string)",
      () => toAsync(stringLazyRowBatches),
      csvSize,
    ),
  );

  // toCsv (from LazyRow string)
  const stringLazyRows: LazyRow[] = rows.map((r) => LazyRow.fromStringArray(r));
  results.push(
    await benchToCsv(
      "toCsv (from LazyRow string)",
      () => toAsync(stringLazyRows),
      csvSize,
    ),
  );

  // toTsv benchmarks
  results.push(
    await benchToTsv(
      "toTsv (from string[][])",
      () => toAsync(batches),
      tsvSize,
    ),
  );
  results.push(
    await benchToTsv("toTsv (from string[])", () => toAsync(rows), tsvSize),
  );
  results.push(
    await benchToTsv(
      "toTsv (from LazyRow[] binary)",
      () => toAsync(actualBinaryLazyRowBatches),
      tsvSize,
    ),
  );
  results.push(
    await benchToTsv(
      "toTsv (from LazyRow binary)",
      () => toAsync(actualBinaryLazyRows),
      tsvSize,
    ),
  );
  results.push(
    await benchToTsv(
      "toTsv (from LazyRow[] string)",
      () => toAsync(stringLazyRowBatches),
      tsvSize,
    ),
  );
  results.push(
    await benchToTsv(
      "toTsv (from LazyRow string)",
      () => toAsync(stringLazyRows),
      tsvSize,
    ),
  );

  // toRecord benchmarks
  results.push(
    await benchToRecord(
      "toRecord (from string[][])",
      () => toAsync(batches),
      recSize,
    ),
  );
  results.push(
    await benchToRecord(
      "toRecord (from string[])",
      () => toAsync(rows),
      recSize,
    ),
  );
  results.push(
    await benchToRecord(
      "toRecord (from LazyRow[] binary)",
      () => toAsync(actualBinaryLazyRowBatches),
      recSize,
    ),
  );
  results.push(
    await benchToRecord(
      "toRecord (from LazyRow binary)",
      () => toAsync(actualBinaryLazyRows),
      recSize,
    ),
  );
  results.push(
    await benchToRecord(
      "toRecord (from LazyRow[] string)",
      () => toAsync(stringLazyRowBatches),
      recSize,
    ),
  );
  results.push(
    await benchToRecord(
      "toRecord (from LazyRow string)",
      () => toAsync(stringLazyRows),
      recSize,
    ),
  );

  // toLazyRowBinary benchmarks (use csvSize for fair comparison)
  results.push(
    await benchToLazyRowBinary(
      "toLazyRowBinary (from string[][])",
      () => toAsync(batches),
      csvSize,
    ),
  );
  results.push(
    await benchToLazyRowBinary(
      "toLazyRowBinary (from string[])",
      () => toAsync(rows),
      csvSize,
    ),
  );
  results.push(
    await benchToLazyRowBinary(
      "toLazyRowBinary (from LazyRow[] binary)",
      () => toAsync(actualBinaryLazyRowBatches),
      csvSize,
    ),
  );
  results.push(
    await benchToLazyRowBinary(
      "toLazyRowBinary (from LazyRow binary)",
      () => toAsync(actualBinaryLazyRows),
      csvSize,
    ),
  );
  results.push(
    await benchToLazyRowBinary(
      "toLazyRowBinary (from LazyRow[] string)",
      () => toAsync(stringLazyRowBatches),
      csvSize,
    ),
  );
  results.push(
    await benchToLazyRowBinary(
      "toLazyRowBinary (from LazyRow string)",
      () => toAsync(stringLazyRows),
      csvSize,
    ),
  );

  // Other transforms

  // CSV benchmarks
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

  // TSV benchmarks
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

  // Record benchmarks
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

  // JSON benchmarks
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
  results.push(
    await bench("fromLazyRowBinary", binarySize, async () => {
      await drain(fromLazyRowBinary()(toAsync([binaryData])));
    }),
  );

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(
    `${"Transform".padEnd(40)} ${"MB/s".padStart(10)} ${"Time".padStart(12)}`,
  );
  console.log("-".repeat(60));
  for (const r of results) {
    console.log(
      `${r.name.padEnd(40)} ${r.throughput.toFixed(1).padStart(10)} ${
        (r.time * 1000).toFixed(0).padStart(9)
      } ms`,
    );
  }

  const avg = results.reduce((s, r) => s + r.throughput, 0) / results.length;
  console.log("-".repeat(60));
  console.log(`${"Average".padEnd(40)} ${avg.toFixed(1).padStart(10)} MB/s`);
  console.log("=".repeat(60));
}

main();
