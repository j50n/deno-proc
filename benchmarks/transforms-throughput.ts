#!/usr/bin/env -S deno run --allow-read
/**
 * Transform throughput: MB/s for every transform in `@j50n/proc/transforms`,
 * the median of several runs after a warm-up run.
 *
 * The data is 100,000 rows of 20 fields. By default it is realistic: words
 * with UTF-8 in them, and about one field in ten quoted for a comma, a `""`
 * escape or an embedded newline. `--simple` uses `field{column}_{row}`
 * instead, which has nothing for a CSV reader to do but find commas.
 *
 * Input arrives in 64 KB chunks, as from a file. Reading is measured against
 * the input size, writing against the output size.
 *
 * ```sh
 * deno run --allow-read benchmarks/transforms-throughput.ts [--simple] [filter]
 * ```
 */

import {
  csvToTsv,
  fromCsvToLazyRows,
  fromCsvToRows,
  fromJsonToRows,
  fromRecordToLazyRows,
  fromRecordToRows,
  fromTsvToLazyRows,
  fromTsvToRows,
  type LazyRow,
  toCsv,
  toJson,
  toRecord,
  toTsv,
  tsvToCsv,
} from "../src/transforms/mod.ts";

const ROWS = 100_000;
const COLUMNS = 20;
const RUNS = 7;

const simple = Deno.args.includes("--simple");
const filter = Deno.args.find((arg) => !arg.startsWith("--"));

const WORDS = [
  "alpha",
  "beta",
  "gamma",
  "délta",
  "epsilon",
  "zeta",
  "東京",
  "theta",
  "12345",
  "3.14159",
  "🎉party",
];

/**
 * A seeded generator of integers in `[0, n)`: mulberry32, whose state stays a
 * 32-bit integer, so it neither loses precision nor repeats for 2^32 draws.
 */
function seededRandom(seed: number): (n: number) => number {
  let state = seed >>> 0;
  return (n) => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 2 ** 32 * n) | 0;
  };
}

/** Rows of realistic fields, the same on every run. */
function realisticRows(): string[][] {
  const random = seededRandom(42);
  return Array.from(
    { length: ROWS },
    () =>
      Array.from({ length: COLUMNS }, () => {
        const words = Array.from(
          { length: 1 + random(3) },
          () => WORDS[random(WORDS.length)],
        ).join(" ");
        switch (random(30)) {
          case 0:
            return `${words}, ${words}`;
          case 1:
            return `say "${words}"`;
          case 2:
            return `${words}\n${words}`;
          default:
            return words;
        }
      }),
  );
}

function simpleRows(): string[][] {
  return Array.from(
    { length: ROWS },
    (_, i) => Array.from({ length: COLUMNS }, (_, j) => `field${j}_${i}`),
  );
}

// The encodings are written here rather than with the library's writers, so
// the readers are measured on input the writers didn't make.
const csvField = (field: string) =>
  /[",\n\r]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;

const encoder = new TextEncoder();
const rows = simple ? simpleRows() : realisticRows();
const tsvRows = rows.map((row) => row.map((f) => f.replaceAll("\n", " ")));

const csv = encoder.encode(
  rows.map((row) => row.map(csvField).join(",") + "\n").join(""),
);
const tsvSafeCsv = encoder.encode(
  tsvRows.map((row) => row.map(csvField).join(",") + "\n").join(""),
);
const tsv = encoder.encode(
  tsvRows.map((row) => row.join("\t") + "\n").join(""),
);
const record = encoder.encode(
  rows.map((row) => row.join("\x1F") + "\x1E").join(""),
);
const jsonLines = encoder.encode(
  rows.map((row) => JSON.stringify(row) + "\n").join(""),
);

function chunked(bytes: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += 65536) {
    chunks.push(bytes.subarray(i, i + 65536));
  }
  return chunks;
}

async function* each<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

/** Batches of 1,000 rows, as a writer would get them. */
function batches<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 1000) {
    out.push(items.slice(i, i + 1000));
  }
  return out;
}

async function countItems(items: AsyncIterable<unknown[]>): Promise<number> {
  let count = 0;
  for await (const batch of items) count += batch.length;
  return count;
}

async function countBytes(chunks: AsyncIterable<Uint8Array>): Promise<number> {
  let size = 0;
  for await (const chunk of chunks) size += chunk.length;
  return size;
}

async function readAll<T>(items: AsyncIterable<T[]>): Promise<T[]> {
  const all: T[] = [];
  for await (const batch of items) all.push(...batch);
  return all;
}

const lazyCsvRows = batches(
  await readAll(fromCsvToLazyRows()(each(chunked(csv)))),
);
const csvChunks = chunked(csv);
const tsvSafeCsvChunks = chunked(tsvSafeCsv);
const tsvChunks = chunked(tsv);
const recordChunks = chunked(record);
const jsonChunks = chunked(jsonLines);
const rowBatches = batches(rows);
const tsvRowBatches = batches(tsvRows);
const jsonValues = rows as unknown[];

/** Rows of a lazy filter: field 3 is "theta", collecting field 7. */
async function lazyFilter(
  match: (row: LazyRow) => boolean,
): Promise<number> {
  let found = 0;
  for await (const batch of fromCsvToLazyRows()(each(csvChunks))) {
    for (const row of batch) if (match(row) && row.getField(7)) found++;
  }
  return found;
}

type Case = [name: string, bytes: number, run: () => Promise<number>];

const cases: Case[] = [
  // Reading: bytes to rows.
  [
    "fromCsvToRows",
    csv.length,
    () => countItems(fromCsvToRows()(each(csvChunks))),
  ],
  [
    "fromCsvToLazyRows",
    csv.length,
    () => countItems(fromCsvToLazyRows()(each(csvChunks))),
  ],
  ["fromCsvToLazyRows + toStringArray", csv.length, async () => {
    let fields = 0;
    for await (const batch of fromCsvToLazyRows()(each(csvChunks))) {
      for (const row of batch) fields += row.toStringArray().length;
    }
    return fields;
  }],
  [
    "filter: fieldEquals",
    csv.length,
    () => lazyFilter((row) => row.fieldEquals(3, "theta")),
  ],
  [
    "filter: getField ===",
    csv.length,
    () => lazyFilter((row) => row.getField(3) === "theta"),
  ],
  ["filter: fromCsvToRows", csv.length, async () => {
    let found = 0;
    for await (const batch of fromCsvToRows()(each(csvChunks))) {
      for (const row of batch) if (row[3] === "theta" && row[7]) found++;
    }
    return found;
  }],
  [
    "fromTsvToRows",
    tsv.length,
    () => countItems(fromTsvToRows()(each(tsvChunks))),
  ],
  [
    "fromTsvToLazyRows",
    tsv.length,
    () => countItems(fromTsvToLazyRows()(each(tsvChunks))),
  ],
  [
    "fromRecordToRows",
    record.length,
    () => countItems(fromRecordToRows()(each(recordChunks))),
  ],
  [
    "fromRecordToLazyRows",
    record.length,
    () => countItems(fromRecordToLazyRows()(each(recordChunks))),
  ],
  [
    "fromJsonToRows",
    jsonLines.length,
    () => countItems(fromJsonToRows()(each(jsonChunks))),
  ],

  // Converting: bytes to bytes, all in WASM.
  [
    "csvToTsv",
    tsvSafeCsv.length,
    () => countBytes(csvToTsv()(each(tsvSafeCsvChunks))),
  ],
  ["tsvToCsv", tsv.length, () => countBytes(tsvToCsv()(each(tsvChunks)))],

  // Writing: rows to bytes.
  [
    "toCsv (string[][])",
    csv.length,
    () => countBytes(toCsv()(each(rowBatches))),
  ],
  [
    "toCsv (LazyRow[] from CSV)",
    csv.length,
    () => countBytes(toCsv()(each(lazyCsvRows))),
  ],
  [
    "toTsv (string[][])",
    tsv.length,
    () => countBytes(toTsv()(each(tsvRowBatches))),
  ],
  [
    "toRecord (string[][])",
    record.length,
    () => countBytes(toRecord()(each(rowBatches))),
  ],
  ["toJson", jsonLines.length, () => countBytes(toJson()(each(jsonValues)))],
];

console.log(
  `${
    simple ? "simple" : "realistic"
  } data: ${ROWS.toLocaleString()} rows × ${COLUMNS}, ` +
    `CSV ${(csv.length / 1e6).toFixed(1)} MB; median of ${RUNS} runs`,
);
console.log(`${"Transform".padEnd(36)} ${"MB/s".padStart(8)}`);
console.log("-".repeat(45));
for (const [name, bytes, run] of cases) {
  if (filter && !name.includes(filter)) continue;
  await run(); // warm-up
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const mbs = bytes / 1e6 / (median / 1000);
  console.log(`${name.padEnd(36)} ${mbs.toFixed(0).padStart(8)}`);
}
