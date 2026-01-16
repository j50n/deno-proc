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
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) =>
        processor.csvToRecordStreaming(input, separator!.charCodeAt(0))
      );

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

const csv2lazyrow = new Command()
  .description("Convert CSV to binary lazyrow format")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) =>
        processor.csvToLazyRowBinaryStreaming(input, separator!.charCodeAt(0))
      );

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
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
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) =>
        processor.csvToTsvStreaming(input, separator!.charCodeAt(0))
      );

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

// TSV input commands
const tsv2record = new Command()
  .description("Convert TSV to record format (\\x1F/\\x1E delimited)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2record")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) => processor.csvToRecordStreaming(input, 9));

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

const tsv2lazyrow = new Command()
  .description("Convert TSV to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) => processor.csvToLazyRowBinaryStreaming(input, 9));

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
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
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) =>
        processor.tsvToCsvStreaming(input, separator!.charCodeAt(0))
      );

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
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
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) =>
        processor.recordToCsvStreaming(input, separator!.charCodeAt(0))
      );

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

const record2tsv = new Command()
  .description("Convert record format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2tsv < data.rec > data.tsv")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) => processor.recordToTsvFast(input));

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

// Lazyrow output commands (binary format)
const lazyrow2csv = new Command()
  .description("Convert binary lazyrow format to CSV")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) =>
        processor.lazyRowBinaryToDelimitedStreaming(
          input,
          separator!.charCodeAt(0),
        )
      );

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

const lazyrow2tsv = new Command()
  .description("Convert binary lazyrow format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) =>
        processor.lazyRowBinaryToDelimitedStreaming(input, 9)
      );

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

// Record <-> Lazyrow conversion commands
const record2lazyrow = new Command()
  .description("Convert record format to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) => processor.recordToLazyRowBinaryStreaming(input));

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
  });

const lazyrow2record = new Command()
  .description("Convert binary lazyrow format to record format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const processor = await FlatdataProcessor.create();
    const stream = input
      ? (await Deno.open(input, { read: true })).readable
      : Deno.stdin.readable;

    const enumerated = enumerate(stream)
      .transform((input) => processor.lazyRowBinaryToRecordStreaming(input));

    await (output
      ? enumerated.writeTo(output)
      : enumerated.writeTo(Deno.stdout.writable, { noclose: true }));
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
