#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * flattext - CLI tool for converting between flat text formats (CSV, TSV)
 *
 * Usage:
 *   flattext csv2tsv [options] < input.csv > output.tsv
 *   flattext tsv2csv [options] < input.tsv > output.csv
 */

import { Command } from "@cliffy/command";
import { FlatText, type ParserConfig } from "./wasm/flattext-api.ts";

// Version from deno.json
const VERSION = "0.1.0";

enum ErrorCode {
  SUCCESS = 0,
  PARSE_ERROR = 1,
  MEMORY_ERROR = 2,
  EMBEDDED_TAB_ERROR = 3,
  EMBEDDED_NEWLINE_ERROR = 4,
}

class ConversionError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = "ConversionError";
  }
}

/**
 * CLI-specific converter that wraps the FlatText API
 */
class FlatTextConverter {
  private converter: FlatText | null = null;

  async init(): Promise<void> {
    this.converter = await FlatText.create();
  }

  async streamCsvToTsv(input: ReadableStream<Uint8Array>, output: WritableStream<Uint8Array>, config?: ParserConfig): Promise<void> {
    if (!this.converter) throw new Error("Converter not initialized");
    return this.converter.streamCsvToTsv(input, output, config);
  }

  async streamTsvToCsv(input: ReadableStream<Uint8Array>, output: WritableStream<Uint8Array>, config?: ParserConfig): Promise<void> {
    if (!this.converter) throw new Error("Converter not initialized");
    return this.converter.streamTsvToCsv(input, output, config);
  }

  dispose(): void {
    // No cleanup needed for the wrapper
  }

  /**
   * Get error message for error code
   */
  getErrorMessage(code: ErrorCode): string {
    switch (code) {
      case ErrorCode.SUCCESS:
        return "Success";
      case ErrorCode.PARSE_ERROR:
        return "Parse error - malformed CSV/TSV";
      case ErrorCode.MEMORY_ERROR:
        return "Memory allocation error";
      case ErrorCode.EMBEDDED_TAB_ERROR:
        return "Embedded tab character found (use replaceTabs option)";
      case ErrorCode.EMBEDDED_NEWLINE_ERROR:
        return "Embedded newline character found (use replaceNewlines option)";
      default:
        return `Unknown error code: ${code}`;
    }
  }
}

// Default configurations
const _DEFAULT_CSV_CONFIG: ParserConfig = {
  delimiter: ",",
  fieldsPerRecord: -1, // Variable field count
  trimLeadingSpace: false,
  lazyQuotes: false,
  multilineFields: true,
};

const _DEFAULT_TSV_CONFIG: ParserConfig = {
  delimiter: "\t",
  fieldsPerRecord: -1, // Variable field count
  trimLeadingSpace: false,
  lazyQuotes: false,
  multilineFields: true,
};

/**
 * Parse character option (handles escape sequences)
 */
function parseCharOption(value: string): string {
  if (value.length === 1) {
    return value;
  }

  // Handle common escape sequences
  switch (value) {
    case "\\t":
      return "\t";
    case "\\n":
      return "\n";
    case "\\r":
      return "\r";
    case "\\\\":
      return "\\";
    case '\\"':
      return '"';
    case "\\'":
      return "'";
    default:
      throw new Error(
        `Invalid character option: ${value}. Use single character or escape sequence.`,
      );
  }
}

/**
 * CSV to TSV conversion command
 */
const csv2tsvCommand = new Command()
  .description("Convert CSV to TSV format")
  .option("--delimiter <char>", "Field delimiter", { default: "," })
  .option("--comment <char>", "Comment character for ignoring lines")
  .option(
    "--fields-per-record <n:number>",
    "Expected field count (-1=variable, 0=auto, >0=fixed)",
    { default: -1 },
  )
  .option("--trim-leading-space", "Remove leading whitespace from fields")
  .option("--lazy-quotes", "Allow unescaped quotes in fields")
  .option("--multiline-fields", "Support quoted multiline fields", {
    default: true,
  })
  .option(
    "--replace-tabs <char>",
    "Replace embedded tabs with character (required for csv2tsv)",
  )
  .option(
    "--replace-newlines <char>",
    "Replace embedded newlines with character",
  )
  .option(
    "--chunk-size <size:number>",
    "Chunk size for streaming processing",
    { default: 65536 },
  )
  .action(async (options) => {
    try {
      const converter = new FlatTextConverter();
      await converter.init();

      const config: ParserConfig = {
        delimiter: parseCharOption(options.delimiter),
        comment: options.comment ? parseCharOption(options.comment) : undefined,
        fieldsPerRecord: options.fieldsPerRecord,
        trimLeadingSpace: options.trimLeadingSpace,
        lazyQuotes: options.lazyQuotes,
        multilineFields: options.multilineFields,
        replaceTabs: options.replaceTabs ? parseCharOption(options.replaceTabs) : undefined,
        replaceNewlines: options.replaceNewlines ? parseCharOption(options.replaceNewlines) : undefined,
      };

      await converter.streamCsvToTsv(Deno.stdin.readable, Deno.stdout.writable, config);
      converter.dispose();
    } catch (error) {
      if (error instanceof ConversionError) {
        switch (error.code) {
          case ErrorCode.EMBEDDED_TAB_ERROR:
            console.error("Error: Embedded tab characters found in CSV data.");
            console.error(
              "Use --replace-tabs <char> to specify a replacement character.",
            );
            console.error("Example: --replace-tabs ' ' (replace with space)");
            break;
          case ErrorCode.EMBEDDED_NEWLINE_ERROR:
            console.error("Error: Embedded newline characters found in data.");
            console.error(
              "Use --replace-newlines <char> to specify a replacement character.",
            );
            console.error(
              "Example: --replace-newlines ' ' (replace with space)",
            );
            break;
          default:
            console.error(`Conversion error: ${(error as Error).message}`);
        }
        Deno.exit(1);
      } else {
        console.error(`Error: ${(error as Error).message}`);
        Deno.exit(1);
      }
    }
  });

/**
 * TSV to CSV conversion command
 */
const tsv2csvCommand = new Command()
  .description("Convert TSV to CSV format")
  .option("--delimiter <char>", "Field delimiter", { default: "\t" })
  .option("--comment <char>", "Comment character for ignoring lines")
  .option(
    "--fields-per-record <n:number>",
    "Expected field count (-1=variable, 0=auto, >0=fixed)",
    { default: -1 },
  )
  .option("--trim-leading-space", "Remove leading whitespace from fields")
  .option("--lazy-quotes", "Allow unescaped quotes in fields")
  .option("--multiline-fields", "Support quoted multiline fields", {
    default: true,
  })
  .option(
    "--replace-newlines <char>",
    "Replace embedded newlines with character",
  )
  .option(
    "--chunk-size <size:number>",
    "Chunk size for streaming processing",
    { default: 65536 },
  )
  .action(async (options) => {
    try {
      const converter = new FlatTextConverter();
      await converter.init();

      const config: ParserConfig = {
        delimiter: parseCharOption(options.delimiter),
        comment: options.comment ? parseCharOption(options.comment) : undefined,
        fieldsPerRecord: options.fieldsPerRecord,
        trimLeadingSpace: options.trimLeadingSpace,
        lazyQuotes: options.lazyQuotes,
        multilineFields: options.multilineFields,
        replaceNewlines: options.replaceNewlines ? parseCharOption(options.replaceNewlines) : undefined,
      };

      await converter.streamTsvToCsv(Deno.stdin.readable, Deno.stdout.writable, config);
      converter.dispose();
    } catch (error) {
      if (error instanceof ConversionError) {
        console.error(`Conversion error: ${(error as Error).message}`);
        Deno.exit(1);
      } else {
        console.error(`Error: ${(error as Error).message}`);
        Deno.exit(1);
      }
    }
  });

/**
 * Main command with subcommands
 */
const main = new Command()
  .name("flattext")
  .version(VERSION)
  .description("Convert between flat text formats (CSV, TSV)")
  .command("csv2tsv", csv2tsvCommand)
  .command("tsv2csv", tsv2csvCommand);

// Run the CLI
if (import.meta.main) {
  await main.parse(Deno.args);
}
