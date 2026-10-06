#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * flatdata - Tabular data format converter
 *
 * A CLI tool for converting between CSV, TSV and record format, built on the
 * transforms in `@j50n/proc/transforms`. CSV to TSV and back run entirely in
 * WebAssembly.
 *
 * Supported formats:
 * - CSV: RFC 4180 comma-separated values (configurable separator)
 * - TSV: Tab-separated values
 * - Record: Text format using \x1F (field) and \x1E (record) separators
 *
 * @example
 * ```bash
 * # Convert CSV to record format
 * cat data.csv | flatdata csv2record > data.rec
 *
 * # Pipeline processing
 * flatdata csv2record -i huge.csv | ./process | flatdata record2csv -o results.csv
 * ```
 *
 * @module
 */

import { Command } from "@cliffy/command";
import { enumerate } from "../../mod.ts";
import type { TransformerFunction } from "../../src/transformers.ts";
import {
  csvToTsv,
  fromCsvToRows,
  fromRecordToRows,
  fromTsvToRows,
  toCsv,
  toRecord,
  toTsv,
  tsvToCsv,
} from "../../src/transforms/mod.ts";
import denoJson from "../../deno.json" with { type: "json" };

// =============================================================================
// Transform Functions (exported for benchmarks and testing)
// =============================================================================

/** Read `input` (or stdin), transform it, and write `output` (or stdout). */
async function convert(
  input: string | undefined,
  output: string | undefined,
  transform: TransformerFunction<Uint8Array, Uint8Array>,
): Promise<void> {
  const stream = input
    ? (await Deno.open(input, { read: true })).readable
    : Deno.stdin.readable;
  const converted = enumerate(stream).transform(transform);
  await (output
    ? converted.writeTo(output)
    : converted.writeTo(Deno.stdout.writable, { noclose: true }));
}

/** Rows through a reader and a writer: one way between any two formats. */
function viaRows(
  reader: TransformerFunction<Uint8Array, string[][]>,
  writer: TransformerFunction<string[][], Uint8Array>,
): TransformerFunction<Uint8Array, Uint8Array> {
  return (bytes) => writer(reader(bytes));
}

export function csv2record(
  input?: string,
  output?: string,
  separator = ",",
): Promise<void> {
  return convert(
    input,
    output,
    viaRows(fromCsvToRows({ separator }), toRecord()),
  );
}

export function csv2tsv(
  input?: string,
  output?: string,
  separator = ",",
): Promise<void> {
  return convert(input, output, csvToTsv({ separator }));
}

export function tsv2record(input?: string, output?: string): Promise<void> {
  return convert(input, output, viaRows(fromTsvToRows(), toRecord()));
}

export function tsv2csv(
  input?: string,
  output?: string,
  separator = ",",
  crlf = false,
): Promise<void> {
  return convert(input, output, tsvToCsv({ separator, crlf }));
}

export function record2csv(
  input?: string,
  output?: string,
  separator = ",",
  crlf = false,
): Promise<void> {
  return convert(
    input,
    output,
    viaRows(fromRecordToRows(), toCsv({ separator, crlf })),
  );
}

export function record2tsv(input?: string, output?: string): Promise<void> {
  return convert(input, output, viaRows(fromRecordToRows(), toTsv()));
}

// =============================================================================
// CLI
// =============================================================================

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

const csv2tsvCmd = new Command()
  .description(
    "Convert CSV to TSV; a field holding a tab, CR or LF is an error",
  )
  .option("-d, --separator <char:string>", "CSV field separator", {
    default: ",",
  })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.csv | flatdata csv2tsv > data.tsv")
  .action(async ({ separator, input, output }) => {
    await csv2tsv(input, output, separator);
  });

const tsv2recordCmd = new Command()
  .description("Convert TSV to record format (\\x1F/\\x1E delimited)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2record")
  .action(async ({ input, output }) => {
    await tsv2record(input, output);
  });

const tsv2csvCmd = new Command()
  .description("Convert TSV to CSV with RFC 4180 quoting")
  .option("-d, --separator <char:string>", "CSV field separator", {
    default: ",",
  })
  .option("--crlf", "Use CRLF line endings (default: LF)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2csv > data.csv")
  .example("Windows format", "flatdata tsv2csv --crlf -d ';' < data.tsv")
  .action(async ({ separator, crlf, input, output }) => {
    await tsv2csv(input, output, separator, !!crlf);
  });

const record2csvCmd = new Command()
  .description("Convert record format to CSV with RFC 4180 quoting")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("--crlf", "Use CRLF line endings (default: LF)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2csv < data.rec > data.csv")
  .example(
    "Pipeline",
    "cat huge.csv | flatdata csv2record | process | flatdata record2csv",
  )
  .action(async ({ separator, crlf, input, output }) => {
    await record2csv(input, output, separator, !!crlf);
  });

const record2tsvCmd = new Command()
  .description("Convert record format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2tsv < data.rec > data.tsv")
  .action(async ({ input, output }) => {
    await record2tsv(input, output);
  });

if (import.meta.main) {
  await new Command()
    .name("flatdata")
    .version(denoJson.version)
    .description(`Convert between tabular data formats.

Formats:
  csv      RFC 4180 comma-separated values (configurable separator)
  tsv      Tab-separated values
  record   Text format using \\x1F (field) and \\x1E (record) separators`)
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
    .command("csv2tsv", csv2tsvCmd)
    .command("tsv2record", tsv2recordCmd)
    .command("tsv2csv", tsv2csvCmd)
    .command("record2csv", record2csvCmd)
    .command("record2tsv", record2tsvCmd)
    .parse(Deno.args);
}
