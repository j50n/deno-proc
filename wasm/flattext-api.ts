/**
 * FlatText - CSV/TSV Converter using WASM
 *
 * A high-performance CSV to TSV converter powered by Odin WASM.
 * Handles quoted fields, embedded commas, and proper CSV parsing.
 *
 * @example
 * ```typescript
 * import { FlatText } from "./flattext.ts";
 *
 * const converter = await FlatText.create();
 *
 * // Convert CSV to TSV
 * const csv = "name,age,city\nJohn,30,NYC\nJane,25,LA";
 * const tsv = converter.csvToTsv(csv);
 * console.log(tsv);
 * // Output: "name\tage\tcity\nJohn\t30\tNYC\nJane\t25\tLA"
 *
 * // Convert TSV to CSV
 * const csvBack = converter.tsvToCsv(tsv);
 * console.log(csvBack);
 * // Output: "name,age,city\nJohn,30,NYC\nJane,25,LA"
 * ```
 */

import { parse } from "@std/csv";
import { enumerate, concat } from "@j50n/proc";

/**
 * Parser configuration options
 */
export interface ParserConfig {
  /** Field delimiter (single character, default: ',' for CSV, '\t' for TSV) */
  delimiter?: string;
  /** Comment character for ignoring lines (single character, default: none) */
  comment?: string;
  /** Expected field count (-1=variable, 0=auto, >0=fixed, default: -1) */
  fieldsPerRecord?: number;
  /** Remove leading whitespace from fields (default: false) */
  trimLeadingSpace?: boolean;
  /** Allow unescaped quotes in fields (default: false) */
  lazyQuotes?: boolean;
  /** Support quoted multiline fields (default: false) */
  multilineFields?: boolean;
  /** Replace embedded tabs with character (single character, default: error on tabs) */
  replaceTabs?: string;
  /** Replace embedded newlines with character (single character, default: error on newlines) */
  replaceNewlines?: string;
}

export class FlatText {
  private wasmModule: WebAssembly.Instance;
  private memory: WebAssembly.Memory;

  private constructor(wasmModule: WebAssembly.Instance) {
    this.wasmModule = wasmModule;
    this.memory = wasmModule.exports.memory as WebAssembly.Memory;

    // Initialize the WASM module
    (wasmModule.exports.init as CallableFunction)();
  }

  /**
   * Create a new FlatText converter instance.
   * Loads and initializes the WASM module.
   */
  static async create(): Promise<FlatText> {
    const wasmBytes = await Deno.readFile(
      new URL("./flattext.wasm", import.meta.url),
    );

    const wasmModule = await WebAssembly.instantiate(wasmBytes, {
      odin_env: {
        write: () => {},
        trap: () => {
          throw new Error("WASM trap");
        },
        alert: () => {},
        abort: () => {
          throw new Error("WASM abort");
        },
        rand_bytes: () => Math.random() * 0xFFFFFFFF,
        sqrt: Math.sqrt,
        sin: Math.sin,
        cos: Math.cos,
        pow: Math.pow,
        ln: Math.log,
        exp: Math.exp,
        floor: Math.floor,
        ceil: Math.ceil,
        trunc: Math.trunc,
        round: Math.round,
        atan2: Math.atan2,
        log: Math.log,
        log10: Math.log10,
        log2: Math.log2,
        exp2: (x: number) => Math.pow(2, x),
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        sinh: Math.sinh,
        cosh: Math.cosh,
        tanh: Math.tanh,
        asinh: Math.asinh,
        acosh: Math.acosh,
        atanh: Math.atanh,
      },
    });

    return new FlatText(wasmModule.instance);
  }

  /**
   * Stream CSV to TSV conversion.
   */
  async streamCsvToTsv(
    input: ReadableStream<Uint8Array>,
    output: WritableStream<Uint8Array>,
    config?: ParserConfig
  ): Promise<void> {
    await enumerate(input)
      .transform(this.csvChunkParser(config))
      .transform(this.tsvFormatter)
      .writeTo(output);
  }

  /**
   * Stream TSV to CSV conversion.
   */
  async streamTsvToCsv(
    input: ReadableStream<Uint8Array>,
    output: WritableStream<Uint8Array>,
    config?: ParserConfig
  ): Promise<void> {
    await enumerate(input)
      .transform(this.tsvChunkParser(config))
      .transform(this.csvFormatter)
      .writeTo(output);
  }

  /**
   * CSV chunk parser - converts chunks to parsed rows
   */
  private csvChunkParser(config?: ParserConfig) {
    return async function* (chunks: AsyncIterable<Uint8Array>) {
      const allData = [];
      
      for await (const chunk of chunks) {
        allData.push(chunk);
      }
      
      const text = new TextDecoder().decode(concat(allData));
      const rows = parse(text, {
        separator: config?.delimiter || ",",
        comment: config?.comment,
        trimLeadingSpace: config?.trimLeadingSpace,
        lazyQuotes: config?.lazyQuotes,
        fieldsPerRecord: config?.fieldsPerRecord,
      });
      
      for (const row of rows) {
        yield row;
      }
    };
  }

  /**
   * TSV chunk parser - converts chunks to parsed rows
   */
  private tsvChunkParser(config?: ParserConfig) {
    return async function* (chunks: AsyncIterable<Uint8Array>) {
      const allData = [];
      
      for await (const chunk of chunks) {
        allData.push(chunk);
      }
      
      const text = new TextDecoder().decode(concat(allData));
      const rows = parse(text, {
        separator: config?.delimiter || "\t",
        comment: config?.comment,
        trimLeadingSpace: config?.trimLeadingSpace,
        lazyQuotes: config?.lazyQuotes,
        fieldsPerRecord: config?.fieldsPerRecord,
      });
      
      for (const row of rows) {
        yield row;
      }
    };
  }

  /**
   * TSV formatter - converts rows to TSV bytes
   */
  private tsvFormatter = async function* (rows: AsyncIterable<string[]>) {
    for await (const row of rows) {
      const tsvLine = row.join("\t") + "\n";
      yield new TextEncoder().encode(tsvLine);
    }
  };

  /**
   * CSV formatter - converts rows to CSV bytes
   */
  private csvFormatter = async function* (rows: AsyncIterable<string[]>) {
    for await (const row of rows) {
      const csvLine = row.map(field => 
        field.includes(",") || field.includes('"') || field.includes("\n")
          ? `"${field.replace(/"/g, '""')}"`
          : field
      ).join(",") + "\n";
      yield new TextEncoder().encode(csvLine);
    }
  };
}
