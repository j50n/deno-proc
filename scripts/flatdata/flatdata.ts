#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * `flatdata`, a command-line converter between CSV, TSV, and the record
 * format.
 *
 * Use it to take parsing out of your program: put `flatdata csv2record` in
 * front of it, and it reads records (fields split on `\x1F`, records ended by
 * `\x1E`) instead of CSV. The parsing runs in WebAssembly, in its own process.
 * The formats are the ones `@j50n/proc/transforms` reads and writes, and they
 * are read the same way.
 *
 * ```sh
 * deno install -g --allow-read --allow-write -n flatdata jsr:@j50n/proc/flatdata
 * ```
 *
 * Without `--allow-read --allow-write` it still works on stdin and stdout.
 *
 * Commands are named `<from>2<to>`: `csv2record`, `csv2tsv`, `tsv2record`,
 * `tsv2csv`, `record2csv`, `record2tsv`. Each reads stdin and writes stdout,
 * or `-i <file>` and `-o <file>`. Commands with CSV on one side take
 * `-d <char>` for the separator (default `,`); `tsv2csv` and `record2csv` also
 * take `--crlf`. `flatdata <command> --help` lists a command's options.
 * `csv2tsv` and `tsv2csv` run entirely in WebAssembly, without making rows.
 *
 * What to watch for: a field the output format can't hold stops the
 * conversion with `flatdata: <message>` on stderr, naming its row and field,
 * and exit code 1. TSV can't hold a tab, CR, or LF in a field, and the record
 * format can't hold `\x1E` or `\x1F`. A CR in CSV or TSV input anywhere but
 * before LF (outside quotes) is an error too, and so is a CSV quote still
 * open at the end of the input. Output written before the error stays, and can
 * end partway through a row. `-o` naming the input file (by any path) is
 * refused before anything is written, since opening the output would empty
 * it. When the reader of stdout goes away, as `| head` does, flatdata stops
 * and exits 0.
 *
 * @example
 * ```sh
 * cat data.csv | flatdata csv2record | ./process | flatdata record2csv -o out.csv
 * flatdata csv2tsv -d ';' -i euro.csv -o data.tsv
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

/**
 * Throw if `output` is the file `input` names, or stdin is when there is no
 * `input`: opening the output empties it before a byte is read. Paths are
 * compared by device and inode, so another path to the same file, or a
 * symlink to it, counts. Without permission to stat, there is no check.
 */
async function refuseSameFile(
  input: string | undefined,
  output: string | undefined,
): Promise<void> {
  if (output === undefined) return;
  const target = await statOf(output);
  const source = await statOf(input ?? "/dev/stdin");
  if (
    target !== undefined && source !== undefined && target.ino !== null &&
    target.dev === source.dev && target.ino === source.ino
  ) {
    throw new Error(
      `${input === undefined ? "stdin" : JSON.stringify(input)} and ${
        JSON.stringify(output)
      } are the same file; writing would empty it`,
    );
  }
}

async function statOf(path: string): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(path);
  } catch {
    return undefined;
  }
}

/** Read `input` (or stdin), transform it, and write `output` (or stdout). */
async function convert(
  input: string | undefined,
  output: string | undefined,
  transform: TransformerFunction<Uint8Array, Uint8Array>,
): Promise<void> {
  await refuseSameFile(input, output);
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

/**
 * CSV to the record format, as the `csv2record` command does.
 * Reads `input`, or stdin, and writes `output`, or stdout.
 */
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

/**
 * CSV to TSV, as the `csv2tsv` command does.
 * Reads `input`, or stdin, and writes `output`, or stdout.
 */
export function csv2tsv(
  input?: string,
  output?: string,
  separator = ",",
): Promise<void> {
  return convert(input, output, csvToTsv({ separator }));
}

/**
 * TSV to the record format, as the `tsv2record` command does.
 * Reads `input`, or stdin, and writes `output`, or stdout.
 */
export function tsv2record(input?: string, output?: string): Promise<void> {
  return convert(input, output, viaRows(fromTsvToRows(), toRecord()));
}

/**
 * TSV to CSV, as the `tsv2csv` command does.
 * Reads `input`, or stdin, and writes `output`, or stdout.
 */
export function tsv2csv(
  input?: string,
  output?: string,
  separator = ",",
  crlf = false,
): Promise<void> {
  return convert(input, output, tsvToCsv({ separator, crlf }));
}

/**
 * The record format to CSV, as the `record2csv` command does.
 * Reads `input`, or stdin, and writes `output`, or stdout.
 */
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

/**
 * The record format to TSV, as the `record2tsv` command does.
 * Reads `input`, or stdin, and writes `output`, or stdout.
 */
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

/**
 * Run `main`, and exit as a command should: quietly with 0 when stdout's
 * reader has gone away, as with `| head`, and with `flatdata: <message>` on
 * stderr and 1 on any other error.
 */
async function exitOnError(main: () => Promise<unknown>): Promise<void> {
  try {
    await main();
  } catch (error) {
    if (error instanceof Deno.errors.BrokenPipe) Deno.exit(0);
    console.error(
      `flatdata: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await exitOnError(() =>
    new Command()
      .name("flatdata")
      .version(denoJson.version)
      .description(`Convert between tabular data formats.

Formats:
  csv      RFC 4180 comma-separated values (configurable separator)
  tsv      Tab-separated values
  record   Text format using \\x1F (field) and \\x1E (record) separators`)
      .example(
        "CSV to record",
        "cat data.csv | flatdata csv2record | ./process",
      )
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
      .parse(Deno.args)
  );
}
