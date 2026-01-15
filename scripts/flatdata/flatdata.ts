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
import { FlatdataProcessor } from "../../src/wasm/flatdata-processor.ts";
import denoJson from "../../deno.json" with { type: "json" };

/** Writer function type for streaming output */
type Writer = (data: Uint8Array) => Promise<number>;

// =============================================================================
// I/O Helpers
// =============================================================================

/**
 * Get input stream from file or stdin.
 * @param file - Optional file path; if omitted, uses stdin
 * @returns Readable stream of bytes
 */
async function getInput(file?: string): Promise<ReadableStream<Uint8Array>> {
  if (file) {
    return (await Deno.open(file, { read: true })).readable;
  }
  return Deno.stdin.readable;
}

/**
 * Get output writer for file or stdout.
 * @param file - Optional file path; if omitted, uses stdout
 * @returns Writer object with write and close methods
 */
async function getWriter(
  file?: string,
): Promise<{ write: Writer; close: () => void }> {
  if (file) {
    const f = await Deno.open(file, {
      write: true,
      create: true,
      truncate: true,
    });
    return { write: (d) => f.write(d), close: () => f.close() };
  }
  return { write: (d) => Deno.stdout.write(d), close: () => {} };
}

// =============================================================================
// CLI
// =============================================================================

// CSV input commands
const csv2record = new Command()
  .description("Convert CSV to record format (\\x1F/\\x1E delimited)")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.csv | flatdata csv2record")
  .example("European CSV", "flatdata csv2record -d ';' -i euro.csv -o data.rec")
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.csvToRecord(stream, write, separator!.charCodeAt(0));
    close();
  });

const csv2lazyrow = new Command()
  .description("Convert CSV to binary lazyrow format")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.csvToLazyRowBinary(stream, write, separator!.charCodeAt(0));
    close();
  });

const csv2tsv = new Command()
  .description("Convert CSV to TSV")
  .option("-d, --separator <char:string>", "CSV field separator", {
    default: ",",
  })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.csv | flatdata csv2tsv > data.tsv")
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.csvToTsv(stream, write, separator!.charCodeAt(0));
    close();
  });

// TSV input commands
const tsv2record = new Command()
  .description("Convert TSV to record format (\\x1F/\\x1E delimited)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2record")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.csvToRecord(stream, write, 9);
    close();
  });

const tsv2lazyrow = new Command()
  .description("Convert TSV to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.csvToLazyRowBinary(stream, write, 9);
    close();
  });

const tsv2csv = new Command()
  .description("Convert TSV to CSV")
  .option("-d, --separator <char:string>", "CSV field separator", {
    default: ",",
  })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2csv > data.csv")
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.tsvToCsv(stream, write, separator!.charCodeAt(0));
    close();
  });

// Record output commands
const record2csv = new Command()
  .description("Convert record format to CSV")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2csv < data.rec > data.csv")
  .example(
    "Pipeline",
    "cat huge.csv | flatdata csv2record | process | flatdata record2csv",
  )
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.recordToDelimited(stream, write, separator!.charCodeAt(0));
    close();
  });

const record2tsv = new Command()
  .description("Convert record format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2tsv < data.rec > data.tsv")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.recordToTsvFast(stream, write);
    close();
  });

// Lazyrow output commands (binary format)
const lazyrow2csv = new Command()
  .description("Convert binary lazyrow format to CSV")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.lazyRowBinaryToDelimited(
      stream,
      write,
      separator!.charCodeAt(0),
    );
    close();
  });

const lazyrow2tsv = new Command()
  .description("Convert binary lazyrow format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.lazyRowBinaryToDelimited(stream, write, 9);
    close();
  });

// Record <-> Lazyrow conversion commands
const record2lazyrow = new Command()
  .description("Convert record format to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.recordToLazyRowBinary(stream, write);
    close();
  });

const lazyrow2record = new Command()
  .description("Convert binary lazyrow format to record format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await processor.lazyRowBinaryToRecord(stream, write);
    close();
  });

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
  .example("Record to CSV", "flatdata record2csv -d ';' < data.rec > euro.csv")
  .example(
    "Full pipeline",
    "flatdata csv2record -i huge.csv | ./analyze | flatdata record2csv -o results.csv",
  )
  .command("csv2record", csv2record)
  .command("csv2lazyrow", csv2lazyrow)
  .command("csv2tsv", csv2tsv)
  .command("tsv2record", tsv2record)
  .command("tsv2lazyrow", tsv2lazyrow)
  .command("tsv2csv", tsv2csv)
  .command("record2csv", record2csv)
  .command("record2tsv", record2tsv)
  .command("record2lazyrow", record2lazyrow)
  .command("lazyrow2csv", lazyrow2csv)
  .command("lazyrow2tsv", lazyrow2tsv)
  .command("lazyrow2record", lazyrow2record)
  .parse(Deno.args);
