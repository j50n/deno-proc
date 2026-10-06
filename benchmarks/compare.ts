#!/usr/bin/env -S deno run --allow-read --allow-env
/**
 * proc's transforms against the best JavaScript can do: Deno's `@std/csv`, the
 * npm parsers Papa Parse and csv-parse/csv-stringify, and a hand-written
 * TypeScript reader. Every contender produces the same rows from the same
 * data, checked before anything is timed.
 *
 * The others get their best case: the whole input decoded to one string, in
 * memory. proc gets the case it is built for: bytes streaming in 64 KB chunks.
 * The data is the realistic data of `transforms-throughput.ts`: 100,000 rows
 * of 20 fields, UTF-8, about one field in ten quoted.
 *
 * ```sh
 * deno run --allow-read --allow-env benchmarks/compare.ts [filter]
 * ```
 */

import {
  CsvParseStream,
  parse as stdParse,
  stringify as stdStringify,
} from "@std/csv";
import Papa from "papaparse";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";
import {
  csvToTsv,
  fromCsvToRows,
  fromTsvToRows,
  toCsv,
} from "../src/transforms/mod.ts";

const ROWS = 100_000;
const COLUMNS = 20;
const RUNS = 7;
const filter = Deno.args[0];

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

/** The same rows as `transforms-throughput.ts`. */
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

const csvField = (field: string) =>
  /[",\n\r]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const rows = realisticRows();
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

function chunked(bytes: Uint8Array): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += 65536) {
    chunks.push(bytes.subarray(i, i + 65536));
  }
  return chunks;
}
const csvChunks = chunked(csv),
  tsvChunks = chunked(tsv),
  tsvSafeChunks = chunked(tsvSafeCsv);

async function* each<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

async function flat<T>(batches: AsyncIterable<T[]>): Promise<T[]> {
  const all: T[] = [];
  for await (const batch of batches) for (const item of batch) all.push(item);
  return all;
}

async function concat(chunks: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const chunk of chunks) parts.push(chunk);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * A careful hand-written reader: a byte state machine turning CSV into
 * unit/record separators, then one decode and native splits. The strongest
 * plain-TypeScript version we found while designing proc's reader.
 */
function handWrittenCsv(bytes: Uint8Array): string[][] {
  const out = new Uint8Array(bytes.length + 1);
  let o = 0, state = 0, rowEmpty = true; // 0 field start, 1 unquoted, 2 quoted, 3 quote in quoted
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (state === 2) {
      if (b === 34) state = 3;
      else out[o++] = b;
      continue;
    }
    if (state === 3) {
      if (b === 34) {
        out[o++] = 34;
        state = 2;
        continue;
      }
      state = 1;
    }
    if (b === 44) {
      out[o++] = 0x1f;
      state = 0;
      rowEmpty = false;
    } else if (b === 10) {
      if (!rowEmpty || state !== 0) out[o++] = 0x1e;
      state = 0;
      rowEmpty = true;
    } else if (b === 34 && state === 0) {
      state = 2;
      rowEmpty = false;
    } else if (b !== 13) {
      out[o++] = b;
      state = 1;
      rowEmpty = false;
    }
  }
  if (!rowEmpty || state !== 0) out[o++] = 0x1e;
  const records = decoder.decode(out.subarray(0, o)).split("\x1e");
  records.pop();
  return records.map((r) => r.split("\x1f"));
}

function splitTsv(text: string): string[][] {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line) => line.split("\t"));
}

type Case = {
  group: string;
  name: string;
  bytes: number;
  run: () => Promise<unknown> | unknown;
  /** Rows, for readers, or bytes to read back as CSV, for writers. */
  check: () => Promise<string[][]> | string[][];
};

const papaRows = (text: string) =>
  Papa.parse<string[]>(text, {
    delimiter: ",",
    newline: "\n",
    skipEmptyLines: true,
  }).data;

const reading: Case[] = [
  {
    group: "CSV to rows",
    name: "proc fromCsvToRows (streaming)",
    bytes: csv.length,
    run: () => flat(fromCsvToRows()(each(csvChunks))),
    check: () => flat(fromCsvToRows()(each(csvChunks))),
  },
  {
    group: "CSV to rows",
    name: "@std/csv CsvParseStream (streaming)",
    bytes: csv.length,
    run: () => stdStream(),
    check: () => stdStream(),
  },
  {
    group: "CSV to rows",
    name: "@std/csv parse (whole string)",
    bytes: csv.length,
    run: () => stdParse(decoder.decode(csv)),
    check: () => stdParse(decoder.decode(csv)),
  },
  {
    group: "CSV to rows",
    name: "Papa Parse (whole string)",
    bytes: csv.length,
    run: () => papaRows(decoder.decode(csv)),
    check: () => papaRows(decoder.decode(csv)),
  },
  {
    group: "CSV to rows",
    name: "csv-parse sync (whole string)",
    bytes: csv.length,
    run: () => csvParse(decoder.decode(csv), { relax_column_count: true }),
    check: () => csvParse(decoder.decode(csv), { relax_column_count: true }),
  },
  {
    group: "CSV to rows",
    name: "hand-written TS (whole buffer)",
    bytes: csv.length,
    run: () => handWrittenCsv(csv),
    check: () => handWrittenCsv(csv),
  },
  {
    group: "TSV to rows",
    name: "proc fromTsvToRows (streaming)",
    bytes: tsv.length,
    run: () => flat(fromTsvToRows()(each(tsvChunks))),
    check: () => flat(fromTsvToRows()(each(tsvChunks))),
  },
  {
    group: "TSV to rows",
    name: "decode + split (whole string)",
    bytes: tsv.length,
    run: () => splitTsv(decoder.decode(tsv)),
    check: () => splitTsv(decoder.decode(tsv)),
  },
];

async function stdStream(): Promise<string[][]> {
  const stream = ReadableStream.from(csvChunks)
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new CsvParseStream());
  return await Array.fromAsync(stream);
}

const rowBatches: string[][][] = [];
for (let i = 0; i < rows.length; i += 1000) {
  rowBatches.push(rows.slice(i, i + 1000));
}
let csvOutBytes = 0;

const writing: Case[] = [
  {
    group: "Rows to CSV",
    name: "proc toCsv (streaming)",
    bytes: 0,
    run: () => concat(toCsv()(each(rowBatches))),
    check: async () =>
      stdParse(decoder.decode(await concat(toCsv()(each(rowBatches))))),
  },
  {
    group: "Rows to CSV",
    name: "@std/csv stringify + encode",
    bytes: 0,
    run: () => encoder.encode(stdStringify(rows)),
    check: () => stdParse(decoder.decode(encoder.encode(stdStringify(rows)))),
  },
  {
    group: "Rows to CSV",
    name: "Papa Parse unparse + encode",
    bytes: 0,
    run: () => encoder.encode(Papa.unparse(rows, { newline: "\n" })),
    check: () =>
      stdParse(
        decoder.decode(encoder.encode(Papa.unparse(rows, { newline: "\n" }))),
      ),
  },
  {
    group: "Rows to CSV",
    name: "csv-stringify sync + encode",
    bytes: 0,
    run: () => encoder.encode(csvStringify(rows)),
    check: () => stdParse(decoder.decode(encoder.encode(csvStringify(rows)))),
  },
  {
    group: "CSV to TSV",
    name: "proc csvToTsv (streaming, bytes to bytes)",
    bytes: tsvSafeCsv.length,
    run: () => concat(csvToTsv()(each(tsvSafeChunks))),
    check: async () =>
      splitTsv(decoder.decode(await concat(csvToTsv()(each(tsvSafeChunks))))),
  },
  {
    group: "CSV to TSV",
    name: "hand-written TS read + join + encode",
    bytes: tsvSafeCsv.length,
    run: () =>
      encoder.encode(
        handWrittenCsv(tsvSafeCsv).map((r) => r.join("\t") + "\n").join(""),
      ),
    check: () =>
      splitTsv(
        decoder.decode(encoder.encode(
          handWrittenCsv(tsvSafeCsv).map((r) => r.join("\t") + "\n").join(""),
        )),
      ),
  },
];

// Writers are measured against the size of the CSV they produce.
csvOutBytes = (await concat(toCsv()(each(rowBatches)))).length;
for (const c of writing) if (c.group === "Rows to CSV") c.bytes = csvOutBytes;

function sameRows(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.length !== y.length) return false;
    for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) return false;
  }
  return true;
}

const cases = [...reading, ...writing].filter((c) =>
  !filter || c.name.includes(filter) || c.group.includes(filter)
);
const expected: Record<string, string[][]> = {
  "CSV to rows": rows,
  "Rows to CSV": rows,
  "TSV to rows": tsvRows,
  "CSV to TSV": tsvRows,
};
for (const c of cases) {
  if (!sameRows(await c.check(), expected[c.group])) {
    throw new Error(`${c.name}: rows differ`);
  }
}
console.log(`All ${cases.length} contenders produce the expected rows.\n`);

console.log(
  `${ROWS.toLocaleString()} rows × ${COLUMNS}, CSV ${
    (csv.length / 1e6).toFixed(1)
  } MB; median of ${RUNS} runs`,
);
let group = "";
for (const c of cases) {
  if (c.group !== group) {
    group = c.group;
    console.log(`\n${group.padEnd(44)} ${"MB/s".padStart(6)}`);
  }
  await c.run(); // warm-up
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await c.run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  console.log(
    `  ${c.name.padEnd(42)} ${
      (c.bytes / 1e6 / (median / 1000)).toFixed(0).padStart(6)
    }`,
  );
}
