/**
 * High-performance CSV transforms using WebAssembly.
 * RFC 4180 compliant parser with streaming support.
 * @module
 */

import { LazyRow } from "./lazy-row.ts";

// Re-export types for API compatibility
export type { CsvParseOptions, CsvStringifyOptions } from "./csv.ts";
import type { CsvParseOptions, CsvStringifyOptions } from "./csv.ts";

const RECORD_SEP = 0x1E;
const FIELD_SEP = 0x1F;

/** Error kinds from the WASM parser */
const CsvErrorKind = {
  None: 0,
  BareQuote: 1,
  UnclosedQuote: 2,
  InvalidCharAfterQuote: 3,
  BareCR: 4,
  FieldCountMismatch: 5,
} as const;

const ErrorMessages: Record<number, string> = {
  [CsvErrorKind.BareQuote]: "Bare quote in unquoted field",
  [CsvErrorKind.UnclosedQuote]: "Unclosed quoted field",
  [CsvErrorKind.InvalidCharAfterQuote]: "Invalid character after closing quote",
  [CsvErrorKind.BareCR]: "Bare carriage return (CR not followed by LF)",
  [CsvErrorKind.FieldCountMismatch]: "Field count mismatch",
};

/** CSV parse error with position information */
export class CsvParseError extends Error {
  constructor(
    public kind: string,
    public row: number,
    public col: number,
    message?: string
  ) {
    super(message ?? `CSV parse error: ${kind} at row ${row}, col ${col}`);
    this.name = kind;
  }
}

/** OdinRuntime provides required imports for Odin WASM modules */
class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  get env(): Record<string, WebAssembly.ImportValue> {
    return {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
      sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp,
      ln: Math.log, log10: Math.log10, log2: Math.log2,
      floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
      abs: Math.abs, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      ldexp: (x: number, exp: number) => x * Math.pow(2, exp),
      fmuladd: (x: number, y: number, z: number) => x * y + z,
      write: () => 0,
      trap: () => { throw new Error("WASM trap"); },
      abort: () => { throw new Error("WASM abort"); },
      alert: () => {},
      evaluate: () => { throw new Error("eval disabled"); },
      time_now: () => BigInt(Date.now()) * 1000000n,
      tick_now: () => performance.now(),
      time_sleep: () => {},
      rand_bytes: (addr: number, len: number) => {
        crypto.getRandomValues(new Uint8Array(this.memory.buffer, addr, len));
      },
    };
  }
}

interface WasmExports {
  memory: WebAssembly.Memory;
  alloc_input_buffer: (size: number) => number;
  alloc_output_buffer: (size: number) => number;
  free_buffer: (ptr: number) => void;
  // Delimited parser
  create_delimited_parser: (sep: number, strict: number, expectedFields: number) => number;
  destroy_delimited_parser: (id: number) => void;
  parse_delimited: (id: number, len: number) => bigint;
  finish_delimited: (id: number) => bigint;
  get_delimited_output: (id: number) => number;
  clear_delimited_output: (id: number) => void;
  get_delimited_error: (id: number) => bigint;
  // Stringifier
  create_delimited_stringifier: (sep: number, crlf: number, alwaysQuote: number, expectedFields: number) => number;
  destroy_delimited_stringifier: (id: number) => void;
  stringify_delimited: (id: number, len: number) => number;
  get_stringify_output: (id: number) => number;
  clear_stringify_output: (id: number) => void;
}

let wasmModule: WebAssembly.Module | null = null;

async function loadWasmModule(): Promise<WebAssembly.Module> {
  if (wasmModule) return wasmModule;
  
  const wasmPath = new URL("../../wasm/flatdata.wasm", import.meta.url);
  const wasmBytes = await Deno.readFile(wasmPath);
  wasmModule = await WebAssembly.compile(wasmBytes);
  return wasmModule;
}

/** CSV processor using WASM for high-performance parsing */
class CsvProcessor {
  private exports: WasmExports;
  private memory: WebAssembly.Memory;
  private parserId = 0;
  private stringifierId = 0;
  private inputPtr = 0;
  private outputPtr = 0;
  private inputCapacity = 0;
  private outputCapacity = 0;

  private constructor(exports: WasmExports, memory: WebAssembly.Memory) {
    this.exports = exports;
    this.memory = memory;
  }

  static async create(): Promise<CsvProcessor> {
    const module = await loadWasmModule();
    const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
    const runtime = new OdinRuntime(memory);
    
    const instance = await WebAssembly.instantiate(module, {
      env: { memory },
      odin_env: runtime.env,
    });
    
    return new CsvProcessor(instance.exports as unknown as WasmExports, memory);
  }

  async *parseChunks(
    bytes: AsyncIterable<Uint8Array>,
    options?: CsvParseOptions
  ): AsyncIterable<string[][]> {
    const sep = options?.separator?.charCodeAt(0) ?? 44;
    const strict = 0; // lenient by default
    const expectedFields = 0;
    
    this.parserId = this.exports.create_delimited_parser(sep, strict, expectedFields);
    
    try {
      for await (const chunk of bytes) {
        this.ensureInputBuffer(chunk.length);
        this.ensureOutputBuffer(chunk.length * 2);
        
        new Uint8Array(this.memory.buffer, this.inputPtr, chunk.length).set(chunk);
        
        const result = this.exports.parse_delimited(this.parserId, chunk.length);
        const rows = Number(result >> 32n);
        const errorKind = Number(result & 0xFFFFFFFFn);
        
        if (errorKind !== 0) {
          this.throwParseError(errorKind);
        }
        
        if (rows > 0) {
          const bytesWritten = this.exports.get_delimited_output(this.parserId);
          if (bytesWritten > 0) {
            yield this.unpackOutput(bytesWritten);
            this.exports.clear_delimited_output(this.parserId);
          }
        }
      }
      
      // Flush remaining data
      const result = this.exports.finish_delimited(this.parserId);
      const rows = Number(result >> 32n);
      const errorKind = Number(result & 0xFFFFFFFFn);
      
      if (errorKind !== 0) {
        this.throwParseError(errorKind);
      }
      
      if (rows > 0) {
        const bytesWritten = this.exports.get_delimited_output(this.parserId);
        if (bytesWritten > 0) {
          yield this.unpackOutput(bytesWritten);
        }
      }
    } finally {
      this.disposeParser();
    }
  }

  async *stringifyChunks(
    data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
    options?: CsvStringifyOptions
  ): AsyncIterable<Uint8Array> {
    const sep = options?.separator?.charCodeAt(0) ?? 44;
    const crlf = 0; // LF by default
    const alwaysQuote = 0;
    const expectedFields = 0;
    
    this.stringifierId = this.exports.create_delimited_stringifier(sep, crlf, alwaysQuote, expectedFields);
    
    try {
      for await (const item of data) {
        const rows = this.normalizeRows(item);
        const delimited = this.packRows(rows);
        
        this.ensureInputBuffer(delimited.length);
        this.ensureOutputBuffer(delimited.length * 2);
        
        new Uint8Array(this.memory.buffer, this.inputPtr, delimited.length).set(delimited);
        
        const success = this.exports.stringify_delimited(this.stringifierId, delimited.length);
        if (!success) {
          throw new Error("CSV stringify failed");
        }
        
        const bytesWritten = this.exports.get_stringify_output(this.stringifierId);
        if (bytesWritten > 0) {
          const output = new Uint8Array(this.memory.buffer, this.outputPtr, bytesWritten);
          yield output.slice(); // Copy since buffer may be reused
          this.exports.clear_stringify_output(this.stringifierId);
        }
      }
    } finally {
      this.disposeStringifier();
    }
  }

  private normalizeRows(item: string[] | string[][] | LazyRow | LazyRow[]): string[][] {
    if (item instanceof LazyRow) {
      return [item.toStringArray()];
    }
    if (Array.isArray(item) && item.length > 0) {
      if (item[0] instanceof LazyRow) {
        return (item as LazyRow[]).map(r => r.toStringArray());
      }
      if (Array.isArray(item[0])) {
        return item as string[][];
      }
      return [item as string[]];
    }
    return [];
  }

  private packRows(rows: string[][]): Uint8Array {
    const parts: string[] = [];
    for (const row of rows) {
      parts.push(row.join(String.fromCharCode(FIELD_SEP)));
      parts.push(String.fromCharCode(RECORD_SEP));
    }
    return new TextEncoder().encode(parts.join(""));
  }

  private throwParseError(errorKind: number): never {
    const errInfo = this.exports.get_delimited_error(this.parserId);
    const row = Number(errInfo >> 32n);
    const col = Number(errInfo & 0xFFFFFFFFn);
    const kindName = Object.entries(CsvErrorKind).find(([_, v]) => v === errorKind)?.[0] ?? "Unknown";
    const message = ErrorMessages[errorKind] ?? "Unknown error";
    throw new CsvParseError(kindName, row, col, `${message} at row ${row}, col ${col}`);
  }

  private ensureInputBuffer(size: number): void {
    if (size > this.inputCapacity) {
      if (this.inputPtr) this.exports.free_buffer(this.inputPtr);
      this.inputCapacity = Math.max(size, 65536);
      this.inputPtr = this.exports.alloc_input_buffer(this.inputCapacity);
    }
  }

  private ensureOutputBuffer(size: number): void {
    if (size > this.outputCapacity) {
      if (this.outputPtr) this.exports.free_buffer(this.outputPtr);
      this.outputCapacity = Math.max(size, 65536);
      this.outputPtr = this.exports.alloc_output_buffer(this.outputCapacity);
    }
  }

  private unpackOutput(bytesWritten: number): string[][] {
    const data = new Uint8Array(this.memory.buffer, this.outputPtr, bytesWritten);
    const text = new TextDecoder().decode(data);
    if (!text) return [];
    
    const rows: string[][] = [];
    // Split on record separator - complete records end with \x1E
    // After split, the last element is empty if text ended with \x1E (complete)
    // or contains partial data if text didn't end with \x1E (incomplete)
    const segments = text.split(String.fromCharCode(RECORD_SEP));
    
    // Process all segments except the last
    for (let i = 0; i < segments.length - 1; i++) {
      const record = segments[i];
      rows.push(record.split(String.fromCharCode(FIELD_SEP)));
    }
    
    // Last segment is empty if all records were complete, ignore it
    // If non-empty, it's an incomplete record - shouldn't happen with correct parser
    return rows;
  }

  private disposeParser(): void {
    if (this.parserId) {
      this.exports.destroy_delimited_parser(this.parserId);
      this.parserId = 0;
    }
    this.disposeBuffers();
  }

  private disposeStringifier(): void {
    if (this.stringifierId) {
      this.exports.destroy_delimited_stringifier(this.stringifierId);
      this.stringifierId = 0;
    }
    this.disposeBuffers();
  }

  private disposeBuffers(): void {
    if (this.inputPtr) {
      this.exports.free_buffer(this.inputPtr);
      this.inputPtr = 0;
      this.inputCapacity = 0;
    }
    if (this.outputPtr) {
      this.exports.free_buffer(this.outputPtr);
      this.outputPtr = 0;
      this.outputCapacity = 0;
    }
  }
}

/**
 * High-performance CSV parsing to string arrays using WASM.
 * RFC 4180 compliant with streaming support.
 */
export function fromCsvToRowsFast(parseOptions?: CsvParseOptions) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<string[][]> {
    const processor = await CsvProcessor.create();
    yield* processor.parseChunks(bytes, parseOptions);
  };
}

/**
 * High-performance CSV parsing to LazyRow objects using WASM.
 * RFC 4180 compliant with streaming support.
 */
export function fromCsvToLazyRowsFast(parseOptions?: CsvParseOptions) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> {
    const processor = await CsvProcessor.create();
    for await (const batch of processor.parseChunks(bytes, parseOptions)) {
      yield batch.map(row => LazyRow.fromStringArray(row));
    }
  };
}

/**
 * High-performance CSV generation using WASM.
 * RFC 4180 compliant output.
 */
export function toCsvFast(stringifyOptions?: CsvStringifyOptions) {
  return async function* (
    data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>
  ): AsyncIterable<Uint8Array> {
    const processor = await CsvProcessor.create();
    yield* processor.stringifyChunks(data, stringifyOptions);
  };
}
