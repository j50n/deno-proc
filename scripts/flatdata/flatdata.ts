#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * flatdata - Tabular data format converter
 *
 * A high-performance CLI tool for converting between tabular data formats.
 * Uses WebAssembly (Odin-compiled) for fast CSV/TSV parsing and stringification.
 *
 * Supported formats:
 * - CSV: RFC 4180 comma-separated values (configurable separator)
 * - TSV: Tab-separated values
 * - Record: Text format using \x1F (field) and \x1E (record) separators
 * - LazyRow: Binary format with length-prefixed fields for efficient random access
 *
 * Performance: ~100+ MB/s for CSV parsing and stringification.
 *
 * @example
 * ```bash
 * # Convert CSV to record format
 * cat data.csv | flatdata csv2record > data.rec
 *
 * # Pipeline processing
 * flatdata csv2record -i huge.csv | ./process | flatdata record2csv -o results.csv
 *
 * # Binary lazyrow format for efficient field access
 * flatdata csv2lazyrow -i data.csv -o data.lazy
 * ```
 *
 * @module
 */

import { Command } from "@cliffy/command";
import { enumerate } from "../../mod.ts";
import { FlatdataProcessor } from "../../src/wasm/flatdata-processor.ts";
import denoJson from "../../deno.json" with { type: "json" };

// =============================================================================
// Transform Functions (exported for benchmarks and testing)
// =============================================================================

export async function csv2record(
  input?: string,
  output?: string,
  separator = ",",
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.csvToRecordStreaming(input, separator.charCodeAt(0))
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function csv2lazyrow(
  input?: string,
  output?: string,
  separator = ",",
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.csvToLazyRowBinaryStreaming(input, separator.charCodeAt(0))
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function csv2tsv(
  input?: string,
  output?: string,
  separator = ",",
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.csvToTsvStreaming(input, separator.charCodeAt(0))
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function tsv2record(
  input?: string,
  output?: string,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.tsvToRecord(input)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function tsv2lazyrow(
  input?: string,
  output?: string,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.tsvToLazyRow(input)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function tsv2csv(
  input?: string,
  output?: string,
  separator = ",",
  alwaysQuote = false,
  crlf = false,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.tsvToCsv(input, separator.charCodeAt(0), alwaysQuote, crlf)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function record2csv(
  input?: string,
  output?: string,
  separator = ",",
  alwaysQuote = false,
  crlf = false,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.recordToCsv(input, separator.charCodeAt(0), alwaysQuote, crlf)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function record2tsv(
  input?: string,
  output?: string,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.recordToTsv(input)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function record2lazyrow(
  input?: string,
  output?: string,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.recordToLazyRowBinaryStreaming(input)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function lazyrow2csv(
  input?: string,
  output?: string,
  separator = ",",
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.lazyRowBinaryToDelimitedStreaming(input, separator.charCodeAt(0))
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function lazyrow2tsv(
  input?: string,
  output?: string,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.lazyRowBinaryToDelimitedStreaming(input, 9)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

export async function lazyrow2record(
  input?: string,
  output?: string,
): Promise<void> {
  const processor = await FlatdataProcessor.create();
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const enumerated = enumerate(stream).transform((input) =>
    processor.lazyRowToRecord(input)
  );
  await (output
    ? enumerated.writeTo(output)
    : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
}

// =============================================================================
// CLI
// =============================================================================

// CSV input commands
const csv2recordCmd = new Command()
  .description("Convert CSV to record format (\\x1F/\\x1E delimited)")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.csv | flatdata csv2record")
  .example("European CSV", "flatdata csv2record -d ';' -i euro.csv -o data.rec")
  .action(async ({ separator, input, output }) => {
    await csv2record(input, output, separator);
  });

const csv2lazyrowCmd = new Command()
  .description("Convert CSV to binary lazyrow format")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    await csv2lazyrow(input, output, separator);
  });

const csv2tsvCmd = new Command()
  .description("Convert CSV to TSV")
  .option("-d, --separator <char:string>", "CSV field separator", {
    default: ",",
  })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.csv | flatdata csv2tsv > data.tsv")
  .action(async ({ separator, input, output }) => {
    await csv2tsv(input, output, separator);
  });

// TSV input commands
const tsv2recordCmd = new Command()
  .description("Convert TSV to record format (\\x1F/\\x1E delimited)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2record")
  .action(async ({ input, output }) => {
    await tsv2record(input, output);
  });

const tsv2lazyrowCmd = new Command()
  .description("Convert TSV to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    await tsv2lazyrow(input, output);
  });

const tsv2csvCmd = new Command()
  .description("Convert TSV to CSV with RFC 4180 quoting")
  .option("-d, --separator <char:string>", "CSV field separator", {
    default: ",",
  })
  .option("--always-quote", "Quote all fields (default: only when needed)")
  .option("--crlf", "Use CRLF line endings (default: LF)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2csv > data.csv")
  .example("Always quote", "flatdata tsv2csv --always-quote < data.tsv")
  .example("Windows format", "flatdata tsv2csv --crlf -d ';' < data.tsv")
  .action(async ({ separator, alwaysQuote, crlf, input, output }) => {
    await tsv2csv(
      input,
      output,
      separator,
      !!alwaysQuote,
      !!crlf,
    );
  });

// Record output commands
const record2csvCmd = new Command()
  .description("Convert record format to CSV with RFC 4180 quoting")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("--always-quote", "Quote all fields (default: only when needed)")
  .option("--crlf", "Use CRLF line endings (default: LF)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2csv < data.rec > data.csv")
  .example("Always quote", "flatdata record2csv --always-quote < data.rec")
  .example(
    "Pipeline",
    "cat huge.csv | flatdata csv2record | process | flatdata record2csv",
  )
  .action(async ({ separator, alwaysQuote, crlf, input, output }) => {
    await record2csv(
      input,
      output,
      separator,
      !!alwaysQuote,
      !!crlf,
    );
  });

const record2tsvCmd = new Command()
  .description("Convert record format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2tsv < data.rec > data.tsv")
  .action(async ({ input, output }) => {
    await record2tsv(input, output);
  });

// Lazyrow output commands (binary format)
const lazyrow2csvCmd = new Command()
  .description("Convert binary lazyrow format to CSV")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    await lazyrow2csv(input, output, separator);
  });

const lazyrow2tsvCmd = new Command()
  .description("Convert binary lazyrow format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    await lazyrow2tsv(input, output);
  });

// Record <-> Lazyrow conversion commands
const record2lazyrowCmd = new Command()
  .description("Convert record format to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    await record2lazyrow(input, output);
  });

const lazyrow2recordCmd = new Command()
  .description("Convert binary lazyrow format to record format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    await lazyrow2record(input, output);
  });

if (import.meta.main) {
  // Main command
  await new Command()
    .name("flatdata")
    .version(denoJson.version)
    .description(`Convert between tabular data formats.

Formats:
  csv      RFC 4180 comma-separated values (configurable separator)
  tsv      Tab-separated values
  record   Text format using \\x1F (field) and \\x1E (record) separators
  lazyrow  Binary format with length-prefixed fields for efficient random access`)
    .example("CSV to record", "cat data.csv | flatdata csv2record | ./process")
    .example(
      "Record to CSV",
      "flatdata record2csv -d ';' < data.rec > euro.csv",
    )
    .example(
      "Full pipeline",
      "flatdata csv2record -i huge.csv | ./analyze | flatdata record2csv -o results.csv",
    )
    .command("csv2record", csv2recordCmd)
    .command("csv2lazyrow", csv2lazyrowCmd)
    .command("csv2tsv", csv2tsvCmd)
    .command("tsv2record", tsv2recordCmd)
    .command("tsv2lazyrow", tsv2lazyrowCmd)
    .command("tsv2csv", tsv2csvCmd)
    .command("record2csv", record2csvCmd)
    .command("record2tsv", record2tsvCmd)
    .command("record2lazyrow", record2lazyrowCmd)
    .command("lazyrow2csv", lazyrow2csvCmd)
    .command("lazyrow2tsv", lazyrow2tsvCmd)
    .command("lazyrow2record", lazyrow2recordCmd)
    .parse(Deno.args);
}
