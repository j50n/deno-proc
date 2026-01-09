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
   * Convert CSV to TSV with optional configuration.
   */
  csvToTsv(csv: string, config?: ParserConfig): string {
    if (config) {
      return this.convertWithConfig(csv, config, "\t");
    }

    // Use simple conversion for default case
    const inputBytes = new TextEncoder().encode(csv);

    const inputPtr = 1000;
    const inputView = new Uint8Array(
      this.memory.buffer,
      inputPtr,
      inputBytes.length,
    );
    inputView.set(inputBytes);

    const outputLen = (this.wasmModule.exports.csv_to_tsv as CallableFunction)(
      inputPtr,
      inputBytes.length,
    ) as number;

    if (outputLen < 0) {
      throw new Error(`CSV parsing failed with code: ${outputLen}`);
    }

    const outputPtr =
      (this.wasmModule.exports.get_output_ptr as CallableFunction)() as number;
    const outputView = new Uint8Array(this.memory.buffer, outputPtr, outputLen);

    return new TextDecoder().decode(outputView);
  }

  /**
   * Convert TSV to CSV with optional configuration.
   */
  tsvToCsv(tsv: string, config?: ParserConfig): string {
    if (config) {
      return this.convertWithConfig(tsv, { ...config, delimiter: "\t" }, ",");
    }

    // Simple replacement for now
    return tsv.replace(/\t/g, ",");
  }

  private convertWithConfig(
    input: string,
    config: ParserConfig,
    _targetDelimiter: string,
  ): string {
    const inputBytes = new TextEncoder().encode(input);

    // Create config struct in WASM memory
    const configPtr = 2000;
    const configView = new DataView(this.memory.buffer, configPtr, 32);

    // Pack config struct (matching Odin Parser_Config)
    // Use first character of string or default values
    const delimiter = config.delimiter ? config.delimiter.charCodeAt(0) : 44; // Default comma
    const comment = config.comment ? config.comment.charCodeAt(0) : 0;
    const replaceTabs = config.replaceTabs
      ? config.replaceTabs.charCodeAt(0)
      : 0;
    const replaceNewlines = config.replaceNewlines
      ? config.replaceNewlines.charCodeAt(0)
      : 0;

    configView.setUint32(0, delimiter, true); // delimiter rune
    configView.setUint32(4, comment, true); // comment rune
    configView.setInt32(8, config.fieldsPerRecord ?? -1, true); // fields_per_record
    configView.setUint8(12, config.trimLeadingSpace ? 1 : 0); // trim_leading_space
    configView.setUint8(13, config.lazyQuotes ? 1 : 0); // lazy_quotes
    configView.setUint8(14, config.multilineFields ? 1 : 0); // multiline_fields
    configView.setUint32(16, replaceTabs, true); // replace_tabs rune
    configView.setUint32(20, replaceNewlines, true); // replace_newlines rune

    // Write input to WASM memory
    const inputPtr = 1000;
    const inputView = new Uint8Array(
      this.memory.buffer,
      inputPtr,
      inputBytes.length,
    );
    inputView.set(inputBytes);

    // Call WASM conversion function with config
    const outputLen =
      (this.wasmModule.exports.csv_to_tsv_with_config as CallableFunction)(
        inputPtr,
        inputBytes.length,
        configPtr,
      ) as number;

    if (outputLen < 0) {
      const errorMessages = {
        [-1]: "Parse error - malformed CSV/TSV",
        [-2]: "Memory allocation error",
        [-3]: "Embedded tab character found (use replaceTabs option)",
        [-4]: "Embedded newline character found (use replaceNewlines option)",
      };
      const message = errorMessages[outputLen as keyof typeof errorMessages] ||
        `Unknown error: ${outputLen}`;
      throw new Error(message);
    }

    const outputPtr =
      (this.wasmModule.exports.get_output_ptr as CallableFunction)() as number;
    const outputView = new Uint8Array(this.memory.buffer, outputPtr, outputLen);

    return new TextDecoder().decode(outputView);
  }
}

/**
 * Convenience functions for one-off conversions without creating an instance.
 */
export class FlatTextUtils {
  private static instance: FlatText | null = null;

  private static async getInstance(): Promise<FlatText> {
    if (!this.instance) {
      this.instance = await FlatText.create();
    }
    return this.instance;
  }

  /**
   * Convert CSV to TSV (convenience function).
   * Creates a shared instance on first use.
   */
  static async csvToTsv(csv: string): Promise<string> {
    const converter = await this.getInstance();
    return converter.csvToTsv(csv);
  }

  /**
   * Convert TSV to CSV (convenience function).
   * Creates a shared instance on first use.
   */
  static async tsvToCsv(tsv: string): Promise<string> {
    const converter = await this.getInstance();
    return converter.tsvToCsv(tsv);
  }
}
