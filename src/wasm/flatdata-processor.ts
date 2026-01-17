/**
 * Unified wrapper for flatdata.wasm operations.
 *
 * This module provides a high-level TypeScript interface to the flatdata WebAssembly module,
 * which implements high-performance CSV/TSV parsing and stringification using Odin.
 *
 * ## Features
 *
 * - **High Performance**: ~100+ MB/s CSV parsing and stringification via WebAssembly
 * - **Streaming**: Processes data in chunks with constant memory usage
 * - **Multiple Formats**: CSV, TSV, record format, and binary lazyrow
 * - **RFC 4180 Compliant**: Proper CSV quoting and escaping
 *
 * ## Supported Conversions
 *
 * - CSV/TSV ↔ Record format (\x1F/\x1E delimited)
 * - CSV/TSV ↔ Binary lazyrow (optimized for random field access)
 * - Record ↔ Binary lazyrow
 *
 * ## Format Details
 *
 * **Record Format**: Uses ASCII control characters for unambiguous separation
 * - \x1F (Unit Separator) between fields
 * - \x1E (Record Separator) between rows
 *
 * **Binary LazyRow Format**: Optimized for O(1) field access without parsing
 * - [row_length: u32] Total bytes for this row
 * - [field_count: u32] Number of fields
 * - [field_lengths: u32[]] Length of each field
 * - [field_data: bytes] Concatenated field data
 *
 * ## Performance Characteristics
 *
 * - **Memory**: Uses fixed 64KB input + 128KB output buffers
 * - **Throughput**: ~100-150 MB/s for CSV parsing
 * - **Latency**: Streaming with minimal buffering
 *
 * ## Thread Safety
 *
 * **Not thread-safe**: Each instance uses shared WASM memory buffers.
 * Create separate instances for concurrent operations.
 *
 * ## Error Handling
 *
 * Methods throw on:
 * - I/O errors (file read/write failures)
 * - Invalid CSV syntax (unclosed quotes, etc.) - currently lenient mode
 * - WASM memory allocation failures
 *
 * @example
 * ```ts
 * // Create processor instance
 * const processor = await FlatdataProcessor.create();
 *
 * // Convert CSV to record format
 * await processor.csvToRecord(inputStream, writeFunction, 44);
 *
 * // Convert back to CSV
 * await processor.recordToCsv(recordStream, writeFunction, 44, false);
 * ```
 *
 * @module
 */

import { LazyRow } from "../transforms/lazy-row.ts";

/** Field separator byte for record format (\x1F - Unit Separator) */
const FIELD_SEP = 0x1F;

/** Record separator byte for record format (\x1E - Record Separator) */
const RECORD_SEP = 0x1E;

/**
 * Writer function type for streaming output.
 * @param data - Chunk of data to write
 * @returns Promise resolving to number of bytes written
 */
type Writer = (data: Uint8Array) => Promise<number>;

/**
 * WebAssembly exports interface for flatdata.wasm.
 *
 * These are the raw WASM functions exposed by the Odin-compiled module.
 * Users should not call these directly - use the FlatdataProcessor methods instead.
 */
interface WasmExports {
  /** Shared linear memory between JS and WASM */
  memory: WebAssembly.Memory;

  /** Allocate input buffer for data transfer to WASM */
  alloc_input_buffer: (size: number) => number;

  /** Allocate output buffer for data transfer from WASM */
  alloc_output_buffer: (size: number) => number;

  /** Get current output buffer pointer (may change after auto-grow) */
  get_output_buffer: () => number;

  /** Create a direct parser instance (outputs directly to buffer) */
  create_direct_parser: (
    separator: number,
    strict: number,
    field_sep: number,
    record_sep: number,
    input_record_sep: number,
  ) => number;

  /** Destroy a direct parser instance */
  destroy_direct_parser: (id: number) => void;

  /** Parse a chunk of CSV data */
  parse_direct: (id: number, len: number) => number;

  /** Finish parsing and flush remaining data */
  finish_direct: (id: number) => number;

  /** Create a delimited stringifier instance */
  create_delimited_stringifier: (
    sep: number,
    crlf: number,
    alwaysQuote: number,
    expectedFields: number,
  ) => number;

  /** Destroy a delimited stringifier instance */
  destroy_delimited_stringifier: (id: number) => void;

  /** Stringify record format to CSV */
  stringify_delimited: (id: number, len: number) => void;

  /** Get stringifier output length */
  get_stringify_output: (id: number) => number;

  /** Clear stringifier output buffer */
  clear_stringify_output: (id: number) => void;

  /** Convert record format to TSV (in-place, SIMD optimized) */
  record_to_tsv: (ptr: number, length: number) => number;

  /** Convert TSV to record format (in-place, strips \r) */
  tsv_to_record: (ptr: number, length: number) => number;

  /** Convert TSV to CSV (separate buffers, handles quoting) */
  tsv_to_csv: (
    input_ptr: number,
    input_len: number,
    output_ptr: number,
    output_capacity: number,
    separator: number,
    always_quote: number,
    crlf: number,
  ) => number;

  /** Convert record format to CSV (separate buffers) */
  record_to_csv: (
    input_ptr: number,
    input_len: number,
    output_ptr: number,
    output_capacity: number,
    separator: number,
    always_quote: number,
    crlf: number,
  ) => number;

  /** Convert TSV to lazyrow binary format (separate buffers) */
  tsv_to_lazyrow: (
    input_ptr: number,
    input_len: number,
    output_ptr: number,
    output_capacity: number,
  ) => number;

  /** Convert lazyrow binary format to record format (separate buffers) */
  lazyrow_to_record: (
    input_ptr: number,
    input_len: number,
    output_ptr: number,
    output_capacity: number,
  ) => number;

  /** Create a lazyrow encoder instance */
  create_lazyrow_encoder: () => number;

  /** Destroy a lazyrow encoder instance */
  destroy_lazyrow_encoder: (id: number) => void;

  /** Encode record format to binary lazyrow */
  lazyrow_encode: (id: number, len: number) => number;

  /** Encode record format to binary lazyrow (from output buffer) */
  lazyrow_encode_from_output: (id: number, len: number) => number;

  /** Create a lazyrow decoder instance */
  create_lazyrow_decoder: () => number;

  /** Destroy a lazyrow decoder instance */
  destroy_lazyrow_decoder: (id: number) => void;

  /** Decode binary lazyrow to record format */
  lazyrow_decode: (id: number, len: number) => number;

  /** Decode binary lazyrow directly to delimited output */
  lazyrow_decode_delimited: (
    id: number,
    len: number,
    fieldSep: number,
    recordSep: number,
  ) => number;

  /** Get how many input bytes were consumed by last decode */
  lazyrow_get_consumed: (id: number) => number;

  /** Create a direct CSV-to-lazyrow parser */
  create_lazyrow_direct_parser: (
    separator: number,
    inputRecordSep: number,
  ) => number;

  /** Destroy a direct lazyrow parser */
  destroy_lazyrow_direct_parser: (id: number) => void;

  /** Parse CSV directly to lazyrow binary format */
  parse_to_lazyrow: (id: number, len: number) => number;

  /** Finish parsing and flush remaining lazyrow data */
  finish_lazyrow_direct: (id: number) => number;

  /** Encode record format directly to lazyrow binary */
  record_to_lazyrow: (len: number) => number;

  /** Check if last operation was truncated due to buffer size */
  was_truncated: () => number;

  /** Create a streaming lazyrow decoder */
  create_streaming_lazyrow_decoder: (
    fieldSep: number,
    recordSep: number,
  ) => number;

  /** Destroy a streaming lazyrow decoder */
  destroy_streaming_lazyrow_decoder: (id: number) => void;

  /** Decode chunk of lazyrow data. Returns 1 if output ready, 0 otherwise */
  streaming_lazyrow_decode: (id: number, len: number) => number;

  /** Get streaming decoder output */
  get_streaming_lazyrow_output: (id: number) => number;

  /** Clear streaming decoder output buffer */
  clear_streaming_lazyrow_output: (id: number) => void;

  /** Finish streaming decode and flush remaining data */
  finish_streaming_lazyrow: (id: number) => number;

  /** Create a streaming record stringifier */
  create_streaming_record_stringifier: (
    outSep: number,
    fieldSep: number,
    recordSep: number,
    crlf: number,
    alwaysQuote: number,
  ) => number;

  /** Destroy a streaming record stringifier */
  destroy_streaming_record_stringifier: (id: number) => void;

  /** Stringify chunk of record data. Returns 1 if output ready, 0 otherwise */
  streaming_record_stringify: (id: number, len: number) => number;

  /** Get streaming stringifier output */
  get_streaming_record_output: (id: number) => number;

  /** Clear streaming stringifier output buffer */
  clear_streaming_record_output: (id: number) => void;

  /** Finish streaming stringify and flush remaining data */
  finish_streaming_record: (id: number) => number;

  /** Create a delimited parser instance (for streaming) */
  create_delimited_parser: (
    sep: number,
    strict: number,
    expectedFields: number,
  ) => number;

  /** Destroy a delimited parser instance */
  destroy_delimited_parser: (id: number) => void;

  /** Parse a chunk with delimited parser */
  parse_delimited: (id: number, len: number) => bigint;

  /** Finish parsing and flush remaining data */
  finish_delimited: (id: number) => bigint;

  /** Get delimited parser output length */
  get_delimited_output: (id: number) => number;

  /** Clear delimited parser output buffer */
  clear_delimited_output: (id: number) => void;

  /** Get delimited parse error info */
  get_delimited_error: (id: number) => bigint;

  /** Convert binary lazyrow format directly to CSV */
  lazyrow_to_csv: (
    input_ptr: number,
    input_len: number,
    output_ptr: number,
    output_capacity: number,
    separator: number,
    crlf: number,
  ) => number;
}

/**
 * Create Odin runtime environment for WASM.
 *
 * Odin-compiled WASM modules require these runtime imports for:
 * - Math functions (sin, cos, sqrt, etc.)
 * - System functions (time, random, etc.)
 *
 * Most are no-ops or stubs since we don't use them in CSV processing.
 *
 * @param memory - WebAssembly memory instance
 * @returns Import object for WASM instantiation
 */
function createOdinRuntime(memory: WebAssembly.Memory): WebAssembly.Imports {
  return {
    env: { memory },
    odin_env: {
      // Math functions
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2,
      sqrt: Math.sqrt,
      pow: Math.pow,
      exp: Math.exp,
      ln: Math.log,
      log10: Math.log10,
      log2: Math.log2,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      trunc: Math.trunc,
      abs: Math.abs,
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      ldexp: (x: number, e: number) => x * Math.pow(2, e),
      fmuladd: (x: number, y: number, z: number) => x * y + z,

      // System stubs (unused in CSV processing)
      write: () => 0,
      trap: () => {},
      abort: () => {},
      alert: () => {},
      evaluate: () => {},
      time_now: () => 0n,
      tick_now: () => 0,
      time_sleep: () => {},
      rand_bytes: () => {},
    },
  };
}

/**
 * Unified processor for all flatdata WASM operations.
 *
 * Provides high-level methods for converting between CSV, TSV, record format,
 * and binary lazyrow format. Handles all WASM memory management internally.
 *
 * ## Usage Pattern
 *
 * 1. Create instance with `FlatdataProcessor.create()`
 * 2. Call conversion methods as needed
 * 3. Instance can be reused for multiple conversions
 *
 * ## Memory Management
 *
 * - Allocates 64KB input buffer and 128KB output buffer on creation
 * - Buffers are reused across all operations
 * - No explicit cleanup needed (garbage collected with instance)
 *
 * @example
 * ```ts
 * const processor = await FlatdataProcessor.create();
 *
 * // CSV to record format
 * await processor.csvToRecord(stream, write, 44); // comma separator
 *
 * // TSV to record format
 * await processor.csvToRecord(stream, write, 9); // tab separator
 *
 * // Record to CSV with minimal quoting
 * await processor.recordToCsv(stream, write, 44, false);
 *
 * // CSV to binary lazyrow for efficient field access
 * await processor.csvToLazyRowBinary(stream, write, 44);
 * ```
 */
export class FlatdataProcessor {
  /** Input buffer size (also used as chunk size) */
  private static readonly DEFAULT_INPUT_SIZE = 64 * 1024;

  /** Initial output buffer size (grows automatically) */
  private static readonly DEFAULT_OUTPUT_SIZE = 128 * 1024;

  /** Chunk size for processing */
  private static readonly CHUNK_SIZE = 64 * 1024;

  private exports: WasmExports;
  private memory: WebAssembly.Memory;
  private inputPtr = 0;
  private inputSize = FlatdataProcessor.DEFAULT_INPUT_SIZE;
  private outputSize = FlatdataProcessor.DEFAULT_OUTPUT_SIZE;

  private constructor(exports: WasmExports, memory: WebAssembly.Memory) {
    this.exports = exports;
    this.memory = memory;
  }

  /**
   * Create a new FlatdataProcessor instance.
   *
   * Loads the WASM module, initializes memory (256 pages = 16MB initial),
   * and allocates input/output buffers.
   *
   * @returns A ready-to-use processor instance
   * @throws Error if WASM module fails to load or initialize
   */
  static async create(): Promise<FlatdataProcessor> {
    const wasmUrl = new URL(`../../wasm/flatdata.wasm`, import.meta.url);
    const wasmBytes = await Deno.readFile(wasmUrl);
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 1024 });

    const { instance } = await WebAssembly.instantiate(
      wasmBytes,
      createOdinRuntime(memory),
    );

    const processor = new FlatdataProcessor(
      instance.exports as unknown as WasmExports,
      memory,
    );
    processor.allocateBuffers();
    return processor;
  }

  /**
   * Allocate input and output buffers in WASM memory.
   * Called automatically during initialization.
   */
  private allocateBuffers(): void {
    this.inputPtr = this.exports.alloc_input_buffer(this.inputSize);
    this.exports.alloc_output_buffer(FlatdataProcessor.DEFAULT_OUTPUT_SIZE);
  }

  /**
   * Get current output buffer pointer (may change after WASM auto-grows it).
   */
  private getOutputPtr(): number {
    return this.exports.get_output_buffer();
  }

  /**
   * Ensure input buffer is large enough for the given size.
   */
  private ensureInputBuffer(size: number): void {
    if (size > this.inputSize) {
      this.inputSize = size;
      this.inputPtr = this.exports.alloc_input_buffer(size);
    }
  }

  private ensureOutputBuffer(size: number): void {
    if (size > this.outputSize) {
      this.outputSize = size;
      this.exports.alloc_output_buffer(size);
    }
  }

  // =============================================================================
  // CSV/TSV ↔ Record Format Conversions
  // =============================================================================

  /**
   * Convert CSV/TSV to record format (\x1F/\x1E delimited).
   *
   * Uses the direct parser for maximum streaming performance. Output is written
   * directly to the output buffer without intermediate copies.
   *
   * **Record format** uses ASCII control characters:
   * - \x1F (Unit Separator) between fields
   * - \x1E (Record Separator) between rows
   *
   * **Performance**: ~100-150 MB/s throughput
   *
   * @param input - Readable stream of CSV/TSV bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   *
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   *
   * // CSV (comma-separated)
   * await processor.csvToRecord(stream, write, 44);
   *
   * // TSV (tab-separated)
   * await processor.csvToRecord(stream, write, 9);
   *
   * // European CSV (semicolon-separated)
   * await processor.csvToRecord(stream, write, 59);
   * ```
   */
  async csvToRecord(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
  ): Promise<void> {
    // CSV input: separator for fields, \n for records
    // Output: \x1F for fields, \x1E for records
    const parserId = this.exports.create_direct_parser(
      separator,
      0,
      0x1F,
      0x1E,
      0x0A,
    );
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (
          let off = 0;
          off < value.length;
          off += FlatdataProcessor.CHUNK_SIZE
        ) {
          const slice = value.subarray(
            off,
            Math.min(off + FlatdataProcessor.CHUNK_SIZE, value.length),
          );
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(
            slice,
          );

          const outLen = this.exports.parse_direct(parserId, slice.length);
          if (outLen < 0) throw new Error("WASM memory allocation failed");
          if (outLen > 0) {
            await write(
              new Uint8Array(this.memory.buffer, this.getOutputPtr(), outLen),
            );
          }
        }
      }

      const finalLen = this.exports.finish_direct(parserId);
      if (finalLen < 0) throw new Error("WASM memory allocation failed");
      if (finalLen > 0) {
        await write(
          new Uint8Array(this.memory.buffer, this.getOutputPtr(), finalLen),
        );
      }
    } finally {
      this.exports.destroy_direct_parser(parserId);
    }
  }

  /**
   * Convert CSV directly to TSV.
   *
   * Fast direct conversion using WASM parser with tab output separator.
   * Much faster than csv→record→tsv pipeline.
   *
   * @param input - Readable stream of CSV bytes
   * @param write - Writer function for output chunks
   * @param separator - CSV field separator (default: comma)
   */
  /**
   * Convert record format to delimited output (CSV/TSV).
   *
   * Simple delimiter replacement - record format has no quoting, so output
   * doesn't need quoting either. Just swaps \x1F→separator, \x1E→\n.
   *
   * @param input - Readable stream of record format bytes
   * @param write - Writer function for output chunks
   * @param separator - Output field separator (comma for CSV, tab for TSV)
   */
  /**
   * Convert record format to CSV/TSV.
   *
   * Takes record format (\x1F/\x1E delimited) and converts it to standard
   * CSV/TSV with proper quoting and escaping according to RFC 4180.
   *
   * **Quoting behavior**:
   * - `quoteAll=false`: Only quotes fields containing separator, quotes, or newlines
   * - `quoteAll=true`: Quotes all fields (safer but larger output)
   *
   * **Performance**: ~100-150 MB/s throughput
   *
   * @param input - Readable stream of record format bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   * @param quoteAll - If true, quote all fields; if false, only quote when necessary
   *
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
  // =============================================================================
  // CSV/TSV ↔ Binary LazyRow Conversions
  // =============================================================================

  /**
   * Convert CSV/TSV to binary lazyrow format.
   *
   * Binary lazyrow format is optimized for random field access without parsing.
   * Each row is encoded as:
   * - `[row_length: u32]` Total bytes for this row (little-endian)
   * - `[field_count: u32]` Number of fields (little-endian)
   * - `[field_lengths: u32[]]` Length of each field (little-endian)
   * - `[field_data: bytes]` Concatenated field data
   *
   * **Benefits**:
   * - O(1) access to any field by index
   * - No string parsing needed for field access
   * - Efficient for columnar operations
   *
   * **Trade-offs**:
   * - Larger file size (~20-30% overhead for metadata)
   * - Binary format (not human-readable)
   *
   * **Performance**: ~100-150 MB/s (single WASM call per chunk)
   *
   * @param input - Readable stream of CSV/TSV bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   *
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   *
   * // Convert CSV to binary lazyrow
   * await processor.csvToLazyRowBinary(stream, write, 44);
   *
   * // Later: read specific fields without parsing entire row
   * // (see LazyRow class for field access)
   * ```
   */
  async csvToLazyRowBinary(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
  ): Promise<void> {
    const parserId = this.exports.create_lazyrow_direct_parser(separator, 0x0A);
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (
          let off = 0;
          off < value.length;
          off += FlatdataProcessor.CHUNK_SIZE
        ) {
          const slice = value.subarray(
            off,
            Math.min(off + FlatdataProcessor.CHUNK_SIZE, value.length),
          );
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(
            slice,
          );

          const outLen = this.exports.parse_to_lazyrow(parserId, slice.length);
          if (outLen > 0) {
            await write(
              new Uint8Array(this.memory.buffer, this.getOutputPtr(), outLen)
                .slice(),
            );
          }
        }
      }

      const finalLen = this.exports.finish_lazyrow_direct(parserId);
      if (finalLen > 0) {
        await write(
          new Uint8Array(this.memory.buffer, this.getOutputPtr(), finalLen)
            .slice(),
        );
      }
    } finally {
      this.exports.destroy_lazyrow_direct_parser(parserId);
    }
  }

  /**
   * Convert binary lazyrow format to CSV/TSV.
   *
   * Reads binary lazyrow format and converts to standard CSV/TSV with proper
   * quoting and escaping. Handles partial rows across chunk boundaries.
   *
   * **Performance**: ~80-120 MB/s (includes binary decoding overhead)
   *
   * @param input - Readable stream of binary lazyrow bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   * @param quoteAll - If true, quote all fields; if false, only quote when necessary
   *
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   *
   * // Convert binary lazyrow back to CSV
   * await processor.lazyRowBinaryToCsv(stream, write, 44, false);
   * ```
   */
  async lazyRowBinaryToCsv(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
    quoteAll: boolean,
  ): Promise<void> {
    const decoderId = this.exports.create_lazyrow_decoder();
    const stringifierId = this.exports.create_delimited_stringifier(
      separator,
      0,
      quoteAll ? 1 : 0,
      0,
    );
    const reader = input.getReader();
    let buffer = new Uint8Array(0);

    const processRows = async (data: Uint8Array): Promise<void> => {
      this.ensureInputBuffer(data.length);
      const inputBuf = new Uint8Array(
        this.memory.buffer,
        this.inputPtr,
        data.length,
      );
      inputBuf.set(data);
      const recordLen = this.exports.lazyrow_decode(decoderId, data.length);

      if (recordLen > 0) {
        this.ensureInputBuffer(recordLen);
        const recordData = new Uint8Array(
          this.memory.buffer,
          this.getOutputPtr(),
          recordLen,
        );
        new Uint8Array(this.memory.buffer, this.inputPtr, recordLen).set(
          recordData,
        );

        this.exports.stringify_delimited(stringifierId, recordLen);

        const outLen = this.exports.get_stringify_output(stringifierId);
        if (outLen > 0) {
          await write(
            new Uint8Array(this.memory.buffer, this.getOutputPtr(), outLen)
              .slice(),
          );
          this.exports.clear_stringify_output(stringifierId);
        }
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Accumulate data
        const newBuf = new Uint8Array(buffer.length + value.length);
        newBuf.set(buffer);
        newBuf.set(value, buffer.length);
        buffer = newBuf;

        // Process complete rows
        while (buffer.length >= 4) {
          const view = new DataView(buffer.buffer, buffer.byteOffset);
          const rowLength = view.getUint32(0, true);
          const totalRowSize = 4 + rowLength;

          if (totalRowSize > buffer.length) break; // Incomplete row

          await processRows(buffer.subarray(0, totalRowSize));
          buffer = buffer.subarray(totalRowSize);
        }
      }

      // Process remaining complete rows
      while (buffer.length >= 4) {
        const view = new DataView(buffer.buffer, buffer.byteOffset);
        const rowLength = view.getUint32(0, true);
        const totalRowSize = 4 + rowLength;

        if (totalRowSize > buffer.length) break;

        await processRows(buffer.subarray(0, totalRowSize));
        buffer = buffer.subarray(totalRowSize);
      }

      // Flush any remaining output
      const outLen = this.exports.get_stringify_output(stringifierId);
      if (outLen > 0) {
        await write(
          new Uint8Array(this.memory.buffer, this.getOutputPtr(), outLen)
            .slice(),
        );
      }
    } finally {
      this.exports.destroy_lazyrow_decoder(decoderId);
      this.exports.destroy_delimited_stringifier(stringifierId);
      reader.releaseLock();
    }
  }

  // =============================================================================
  // Record ↔ Binary LazyRow Conversions
  // =============================================================================

  /**
   * Convert record format to binary lazyrow format.
   *
   * Takes record format (\x1F/\x1E delimited) and converts to binary lazyrow
   * format for efficient random field access. Handles partial records across
   * chunk boundaries.
   *
   * **Use case**: When you have record format data and need efficient field access.
   *
   * **Performance**: ~150-200 MB/s (pure format conversion, no CSV parsing)
   *
   * @param input - Readable stream of record format bytes
   * @param write - Writer function for output chunks
   *
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   * await processor.recordToLazyRowBinary(stream, write);
   * ```
   */
  async recordToLazyRowBinary(
    input: ReadableStream<Uint8Array>,
    write: Writer,
  ): Promise<void> {
    const reader = input.getReader();
    let buffer = new Uint8Array(0);
    const RECORD_SEP = 0x1E;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Accumulate data
        const newBuf = new Uint8Array(buffer.length + value.length);
        newBuf.set(buffer);
        newBuf.set(value, buffer.length);
        buffer = newBuf;

        // Find last complete record (ends with \x1E)
        let lastRecordEnd = -1;
        for (let i = buffer.length - 1; i >= 0; i--) {
          if (buffer[i] === RECORD_SEP) {
            lastRecordEnd = i;
            break;
          }
        }

        if (lastRecordEnd >= 0) {
          const completeData = buffer.subarray(0, lastRecordEnd + 1);
          this.ensureInputBuffer(completeData.length);
          const inputBuf = new Uint8Array(
            this.memory.buffer,
            this.inputPtr,
            completeData.length,
          );
          inputBuf.set(completeData);

          const outLen = this.exports.record_to_lazyrow(completeData.length);
          if (outLen > 0) {
            const outputBuf = new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            );
            await write(outputBuf.slice());
          }

          buffer = buffer.subarray(lastRecordEnd + 1);
        }
      }

      // Process any remaining complete records
      if (buffer.length > 0) {
        let lastRecordEnd = -1;
        for (let i = buffer.length - 1; i >= 0; i--) {
          if (buffer[i] === RECORD_SEP) {
            lastRecordEnd = i;
            break;
          }
        }

        if (lastRecordEnd >= 0) {
          const completeData = buffer.subarray(0, lastRecordEnd + 1);
          this.ensureInputBuffer(completeData.length);
          const inputBuf = new Uint8Array(
            this.memory.buffer,
            this.inputPtr,
            completeData.length,
          );
          inputBuf.set(completeData);

          const outLen = this.exports.record_to_lazyrow(completeData.length);
          if (outLen > 0) {
            const outputBuf = new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            );
            await write(outputBuf.slice());
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Convert binary lazyrow format to record format.
   *
   * High-performance streaming decoder - WASM handles all buffering internally.
   * Outputs record format (\x1F/\x1E delimited).
   *
   * @param input - Readable stream of binary lazyrow bytes
   * @param write - Writer function for output chunks
   */
  /**
   * Convert binary lazyrow format to CSV/TSV.
   *
   * High-performance streaming decoder - WASM handles all buffering internally.
   * Accumulates output until threshold before writing for maximum throughput.
   *
   * @param input - Readable stream of binary lazyrow bytes
   * @param write - Writer function for output chunks
   * @param separator - Output field separator
   */
  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Write a single row in binary lazyrow format.
   * Splits record on FIELD_SEP and encodes as binary lazyrow.
   *
   * @param record - Record format row (fields separated by \x1F)
   * @param write - Writer function for output
   */
  private async writeRowAsBinary(
    record: Uint8Array,
    write: Writer,
  ): Promise<void> {
    // Split on FIELD_SEP to extract fields
    const fields: Uint8Array[] = [];
    let fieldStart = 0;
    for (let i = 0; i <= record.length; i++) {
      if (i === record.length || record[i] === FIELD_SEP) {
        fields.push(record.subarray(fieldStart, i));
        fieldStart = i + 1;
      }
    }

    // Calculate sizes
    const fieldCount = fields.length;
    const dataSize = fields.reduce((sum, f) => sum + f.length, 0);
    const headerSize = 4 + fieldCount * 4; // field_count + field_lengths array
    const rowLength = headerSize + dataSize;

    // Encode binary lazyrow format
    const buffer = new Uint8Array(4 + rowLength); // row_length + row_data
    const view = new DataView(buffer.buffer);

    view.setUint32(0, rowLength, true); // row_length (little-endian)
    view.setUint32(4, fieldCount, true); // field_count (little-endian)

    // Write field lengths
    let offset = 8 + fieldCount * 4;
    for (let i = 0; i < fieldCount; i++) {
      view.setUint32(8 + i * 4, fields[i].length, true);
      buffer.set(fields[i], offset);
      offset += fields[i].length;
    }

    await write(buffer);
  }

  /**
   * Convert a single binary lazyrow to record format.
   * Decodes binary lazyrow and reconstructs record format with \x1F/\x1E separators.
   *
   * @param rowData - Binary lazyrow data for one row
   * @returns Record format bytes (\x1F/\x1E delimited)
   */
  private binaryRowToRecord(rowData: Uint8Array): Uint8Array {
    const view = new DataView(rowData.buffer, rowData.byteOffset);
    const fieldCount = view.getUint32(0, true);

    // Read field lengths
    const fieldLengths: number[] = [];
    for (let i = 0; i < fieldCount; i++) {
      fieldLengths.push(view.getUint32(4 + i * 4, true));
    }

    // Calculate output size
    const dataStart = 4 + fieldCount * 4;
    const totalDataLen = fieldLengths.reduce((a, b) => a + b, 0);
    const outputLen = totalDataLen + fieldCount; // data + separators

    // Reconstruct record format
    const output = new Uint8Array(outputLen);
    let readOff = dataStart;
    let writeOff = 0;

    for (let i = 0; i < fieldCount; i++) {
      const len = fieldLengths[i];
      output.set(rowData.subarray(readOff, readOff + len), writeOff);
      readOff += len;
      writeOff += len;
      // Add separator: \x1F between fields, \x1E after last field
      output[writeOff++] = i < fieldCount - 1 ? FIELD_SEP : RECORD_SEP;
    }

    return output;
  }

  async *csvToRowsStreaming(
    input: AsyncIterable<Uint8Array>,
    parseOptions?: { separator?: string },
  ): AsyncIterable<string[][]> {
    const separator = parseOptions?.separator?.charCodeAt(0) ?? 44;
    const lazyRowStream = this.csvToLazyRowsStreaming(input, separator);

    for await (const batch of lazyRowStream) {
      yield batch.map((row) => row.toStringArray());
    }
  }

  async *csvToLazyRowsStreaming(
    input: AsyncIterable<Uint8Array>,
    separator = 44,
  ): AsyncIterable<LazyRow[]> {
    const binaryStream = this.csvToLazyRowBinaryStreaming(input, separator);

    let buffer = new Uint8Array(0);
    let currentBatch: LazyRow[] = [];
    const BATCH_SIZE = 100;

    for await (const chunk of binaryStream) {
      const combined = new Uint8Array(buffer.length + chunk.length);
      combined.set(buffer);
      combined.set(chunk, buffer.length);
      buffer = combined;

      let offset = 0;
      while (buffer.length - offset >= 4) {
        const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
        const rowLength = view.getUint32(0, true);

        if (buffer.length - offset < 4 + rowLength) break;

        const rowData = buffer.subarray(offset + 4, offset + 4 + rowLength);
        currentBatch.push(LazyRow.fromBinary(rowData));
        offset += 4 + rowLength;

        if (currentBatch.length >= BATCH_SIZE) {
          yield currentBatch;
          currentBatch = [];
        }
      }

      buffer = buffer.subarray(offset);
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  }

  async *recordToCsvStreaming(
    input: AsyncIterable<Uint8Array>,
    separator = 44,
    crlf = false,
  ): AsyncIterable<Uint8Array> {
    const stringifierId = this.exports.create_delimited_stringifier(
      separator,
      crlf ? 1 : 0,
      0,
      0,
    );
    try {
      let buffer = new Uint8Array(0);
      const RECORD_SEP = 0x1E;

      for await (const chunk of input) {
        if (chunk.length === 0) continue;

        // Append chunk to buffer
        const newBuffer = new Uint8Array(buffer.length + chunk.length);
        newBuffer.set(buffer);
        newBuffer.set(chunk, buffer.length);
        buffer = newBuffer;

        // Find last record separator
        let lastRecordEnd = -1;
        for (let i = buffer.length - 1; i >= 0; i--) {
          if (buffer[i] === RECORD_SEP) {
            lastRecordEnd = i + 1;
            break;
          }
        }

        // Process complete records if found
        if (lastRecordEnd > 0) {
          const completeRecords = buffer.slice(0, lastRecordEnd);
          buffer = buffer.slice(lastRecordEnd);

          this.ensureInputBuffer(completeRecords.length);
          new Uint8Array(
            this.memory.buffer,
            this.inputPtr,
            completeRecords.length,
          ).set(completeRecords);
          this.exports.stringify_delimited(
            stringifierId,
            completeRecords.length,
          );

          const bytesWritten = this.exports.get_stringify_output(stringifierId);
          if (bytesWritten > 0) {
            const outputPtr = this.getOutputPtr();
            const output = new Uint8Array(
              this.memory.buffer,
              outputPtr,
              bytesWritten,
            ).slice();
            yield output;
            this.exports.clear_stringify_output(stringifierId);
          }
        }
      }

      // Process any remaining data
      if (buffer.length > 0) {
        this.ensureInputBuffer(buffer.length);
        new Uint8Array(this.memory.buffer, this.inputPtr, buffer.length).set(
          buffer,
        );
        this.exports.stringify_delimited(stringifierId, buffer.length);

        const bytesWritten = this.exports.get_stringify_output(stringifierId);
        if (bytesWritten > 0) {
          const outputPtr = this.getOutputPtr();
          const output = new Uint8Array(
            this.memory.buffer,
            outputPtr,
            bytesWritten,
          ).slice();
          yield output;
          this.exports.clear_stringify_output(stringifierId);
        }
      }
    } finally {
      this.exports.destroy_delimited_stringifier(stringifierId);
    }
  }

  /**
   * Convert record format to TSV using SIMD-optimized in-place transformation.
   * Replaces 0x1F (field separator) with tab and 0x1E (record separator) with newline.
   * Much faster than going through the CSV stringifier.
   */
  async *recordToTsv(
    input: AsyncIterable<Uint8Array>,
  ): AsyncGenerator<Uint8Array> {
    for await (const chunk of input) {
      if (chunk.length === 0) continue;

      this.ensureInputBuffer(chunk.length);
      new Uint8Array(this.memory.buffer, this.inputPtr, chunk.length).set(
        chunk,
      );

      const outputLen = this.exports.record_to_tsv(this.inputPtr, chunk.length);

      yield new Uint8Array(this.memory.buffer, this.inputPtr, outputLen)
        .slice();
    }
  }

  /**
   * Convert TSV to record format using optimized in-place transformation.
   * Replaces tab with 0x1F (field separator), newline with 0x1E (record separator).
   * Strips carriage returns. Much faster than using the CSV parser.
   */
  async *tsvToRecord(
    input: AsyncIterable<Uint8Array>,
  ): AsyncGenerator<Uint8Array> {
    for await (const chunk of input) {
      if (chunk.length === 0) continue;

      this.ensureInputBuffer(chunk.length);
      new Uint8Array(this.memory.buffer, this.inputPtr, chunk.length).set(
        chunk,
      );

      const outputLen = this.exports.tsv_to_record(this.inputPtr, chunk.length);

      yield new Uint8Array(this.memory.buffer, this.inputPtr, outputLen)
        .slice();
    }
  }

  /**
   * Convert TSV to CSV with proper RFC 4180 quoting.
   * Handles fields containing separator, quotes, or newlines.
   * Strips carriage returns. Much faster than using the CSV parser.
   */
  async *tsvToCsv(
    input: AsyncIterable<Uint8Array>,
    separator = 44, // comma
    alwaysQuote = false,
    crlf = false,
  ): AsyncGenerator<Uint8Array> {
    // Allocate output buffer (2x input for worst case quoting)
    const outputCapacity = 256 * 1024;
    const outputPtr = this.exports.alloc_output_buffer(outputCapacity);

    for await (const chunk of input) {
      if (chunk.length === 0) continue;

      this.ensureInputBuffer(chunk.length);
      new Uint8Array(this.memory.buffer, this.inputPtr, chunk.length).set(
        chunk,
      );

      const outputLen = this.exports.tsv_to_csv(
        this.inputPtr,
        chunk.length,
        outputPtr,
        outputCapacity,
        separator,
        alwaysQuote ? 1 : 0,
        crlf ? 1 : 0,
      );

      if (outputLen < 0) {
        throw new Error(
          "TSV to CSV conversion failed: output buffer too small",
        );
      }

      yield new Uint8Array(this.memory.buffer, outputPtr, outputLen).slice();
    }
  }

  async *recordToCsv(
    input: AsyncIterable<Uint8Array>,
    separator = 44, // comma
    alwaysQuote = false,
    crlf = false,
  ): AsyncGenerator<Uint8Array> {
    // Allocate output buffer (2x input for worst case quoting)
    const outputCapacity = 256 * 1024;
    const outputPtr = this.exports.alloc_output_buffer(outputCapacity);

    for await (const chunk of input) {
      if (chunk.length === 0) continue;

      this.ensureInputBuffer(chunk.length);
      new Uint8Array(this.memory.buffer, this.inputPtr, chunk.length).set(
        chunk,
      );

      const outputLen = this.exports.record_to_csv(
        this.inputPtr,
        chunk.length,
        outputPtr,
        outputCapacity,
        separator,
        alwaysQuote ? 1 : 0,
        crlf ? 1 : 0,
      );

      if (outputLen < 0) {
        throw new Error(
          "Record to CSV conversion failed: output buffer too small",
        );
      }

      yield new Uint8Array(this.memory.buffer, outputPtr, outputLen).slice();
    }
  }

  /**
   * Convert TSV directly to lazyrow binary format.
   * Parses TSV and encodes to lazyrow in a single pass.
   * Strips carriage returns. Much faster than using the CSV parser.
   */
  async *tsvToLazyRow(
    input: AsyncIterable<Uint8Array>,
  ): AsyncGenerator<Uint8Array> {
    const outputCapacity = 2 * 1024 * 1024;
    const outputPtr = this.exports.alloc_output_buffer(outputCapacity);

    // Persistent carry buffer - grows as needed, reused across iterations
    let carryBuf = new Uint8Array(64 * 1024);
    let carryLen = 0;

    for await (const chunk of input) {
      if (chunk.length === 0) continue;

      // Ensure carry buffer can hold carry + chunk
      const needed = carryLen + chunk.length;
      if (needed > carryBuf.length) {
        const newBuf = new Uint8Array(Math.max(needed, carryBuf.length * 2));
        newBuf.set(carryBuf.subarray(0, carryLen));
        carryBuf = newBuf;
      }

      // Append chunk to carry buffer
      carryBuf.set(chunk, carryLen);
      const totalLen = carryLen + chunk.length;

      // Find last newline
      let lastNewline = -1;
      for (let i = totalLen - 1; i >= 0; i--) {
        if (carryBuf[i] === 0x0A) {
          lastNewline = i;
          break;
        }
      }

      if (lastNewline === -1) {
        carryLen = totalLen;
        continue;
      }

      // Process complete rows
      const completeLen = lastNewline + 1;
      this.ensureInputBuffer(completeLen);
      new Uint8Array(this.memory.buffer, this.inputPtr, completeLen).set(
        carryBuf.subarray(0, completeLen),
      );

      const outputLen = this.exports.tsv_to_lazyrow(
        this.inputPtr,
        completeLen,
        outputPtr,
        outputCapacity,
      );

      if (outputLen < 0) {
        throw new Error(
          "TSV to lazyrow conversion failed: output buffer too small",
        );
      }

      if (outputLen > 0) {
        yield new Uint8Array(this.memory.buffer, outputPtr, outputLen).slice();
      }

      // Move incomplete row to start of buffer
      carryLen = totalLen - completeLen;
      if (carryLen > 0) {
        carryBuf.copyWithin(0, completeLen, totalLen);
      }
    }

    // Process remaining data
    if (carryLen > 0) {
      this.ensureInputBuffer(carryLen);
      new Uint8Array(this.memory.buffer, this.inputPtr, carryLen).set(
        carryBuf.subarray(0, carryLen),
      );

      const outputLen = this.exports.tsv_to_lazyrow(
        this.inputPtr,
        carryLen,
        outputPtr,
        outputCapacity,
      );

      if (outputLen < 0) {
        throw new Error(
          "TSV to lazyrow conversion failed: output buffer too small",
        );
      }

      if (outputLen > 0) {
        yield new Uint8Array(this.memory.buffer, outputPtr, outputLen).slice();
      }
    }
  }

  // =============================================================================
  // Async Generator Versions (for enumerate pattern)
  // =============================================================================

  async *csvToRecordStreaming(
    input: AsyncIterable<Uint8Array>,
    separator: number,
  ): AsyncGenerator<Uint8Array> {
    const parserId = this.exports.create_direct_parser(
      separator,
      0,
      0x1F,
      0x1E,
      0x0A,
    );
    try {
      for await (const chunk of input) {
        for (
          let off = 0;
          off < chunk.length;
          off += FlatdataProcessor.CHUNK_SIZE
        ) {
          const slice = chunk.subarray(
            off,
            Math.min(off + FlatdataProcessor.CHUNK_SIZE, chunk.length),
          );
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(
            slice,
          );

          const outLen = this.exports.parse_direct(parserId, slice.length);
          if (outLen < 0) throw new Error("WASM memory allocation failed");
          if (outLen > 0) {
            yield new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            ).slice();
          }
        }
      }

      const finalLen = this.exports.finish_direct(parserId);
      if (finalLen < 0) throw new Error("WASM memory allocation failed");
      if (finalLen > 0) {
        yield new Uint8Array(this.memory.buffer, this.getOutputPtr(), finalLen)
          .slice();
      }
    } finally {
      this.exports.destroy_direct_parser(parserId);
    }
  }

  async *csvToTsvStreaming(
    input: AsyncIterable<Uint8Array>,
    separator: number,
  ): AsyncGenerator<Uint8Array> {
    const parserId = this.exports.create_direct_parser(
      separator,
      0,
      0x09,
      0x0A,
      0x0A,
    );
    try {
      for await (const chunk of input) {
        for (
          let off = 0;
          off < chunk.length;
          off += FlatdataProcessor.CHUNK_SIZE
        ) {
          const slice = chunk.subarray(
            off,
            Math.min(off + FlatdataProcessor.CHUNK_SIZE, chunk.length),
          );
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(
            slice,
          );

          const outLen = this.exports.parse_direct(parserId, slice.length);
          if (outLen > 0) {
            yield new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            ).slice();
          }
        }
      }

      const finalLen = this.exports.finish_direct(parserId);
      if (finalLen > 0) {
        yield new Uint8Array(this.memory.buffer, this.getOutputPtr(), finalLen)
          .slice();
      }
    } finally {
      this.exports.destroy_direct_parser(parserId);
    }
  }

  async *tsvToCsvStreaming(
    input: AsyncIterable<Uint8Array>,
    separator: number,
  ): AsyncGenerator<Uint8Array> {
    const parserId = this.exports.create_direct_parser(
      0x09,
      0,
      separator,
      0x0A,
      0x0A,
    );
    try {
      for await (const chunk of input) {
        for (
          let off = 0;
          off < chunk.length;
          off += FlatdataProcessor.CHUNK_SIZE
        ) {
          const slice = chunk.subarray(
            off,
            Math.min(off + FlatdataProcessor.CHUNK_SIZE, chunk.length),
          );
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(
            slice,
          );

          const outLen = this.exports.parse_direct(parserId, slice.length);
          if (outLen > 0) {
            yield new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            ).slice();
          }
        }
      }

      const finalLen = this.exports.finish_direct(parserId);
      if (finalLen > 0) {
        yield new Uint8Array(this.memory.buffer, this.getOutputPtr(), finalLen)
          .slice();
      }
    } finally {
      this.exports.destroy_direct_parser(parserId);
    }
  }

  async *csvToLazyRowBinaryStreaming(
    input: AsyncIterable<Uint8Array>,
    separator: number,
  ): AsyncGenerator<Uint8Array> {
    const parserId = this.exports.create_lazyrow_direct_parser(separator, 0x0A);
    try {
      for await (const chunk of input) {
        for (
          let off = 0;
          off < chunk.length;
          off += FlatdataProcessor.CHUNK_SIZE
        ) {
          const slice = chunk.subarray(
            off,
            Math.min(off + FlatdataProcessor.CHUNK_SIZE, chunk.length),
          );
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(
            slice,
          );

          const outLen = this.exports.parse_to_lazyrow(parserId, slice.length);
          if (outLen > 0) {
            yield new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            ).slice();
          }
        }
      }

      const finalLen = this.exports.finish_lazyrow_direct(parserId);
      if (finalLen > 0) {
        yield new Uint8Array(this.memory.buffer, this.getOutputPtr(), finalLen)
          .slice();
      }
    } finally {
      this.exports.destroy_lazyrow_direct_parser(parserId);
    }
  }

  async *lazyRowBinaryToDelimitedStreaming(
    input: AsyncIterable<Uint8Array>,
    separator: number,
  ): AsyncGenerator<Uint8Array> {
    const decoderId = this.exports.create_streaming_lazyrow_decoder(
      separator,
      0x0A,
    );
    try {
      for await (const chunk of input) {
        this.ensureInputBuffer(chunk.length);
        new Uint8Array(this.memory.buffer, this.inputPtr, chunk.length).set(
          chunk,
        );

        const ready = this.exports.streaming_lazyrow_decode(
          decoderId,
          chunk.length,
        );
        if (ready) {
          const outLen = this.exports.get_streaming_lazyrow_output(decoderId);
          if (outLen > 0) {
            yield new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            ).slice();
            this.exports.clear_streaming_lazyrow_output(decoderId);
          }
        }
      }

      const outLen = this.exports.finish_streaming_lazyrow(decoderId);
      if (outLen > 0) {
        this.exports.get_streaming_lazyrow_output(decoderId);
        yield new Uint8Array(this.memory.buffer, this.getOutputPtr(), outLen)
          .slice();
      }
    } finally {
      this.exports.destroy_streaming_lazyrow_decoder(decoderId);
    }
  }

  async *lazyRowBinaryToRecordStreaming(
    input: AsyncIterable<Uint8Array>,
  ): AsyncGenerator<Uint8Array> {
    const decoderId = this.exports.create_streaming_lazyrow_decoder(0x1F, 0x1E);
    try {
      for await (const chunk of input) {
        this.ensureInputBuffer(chunk.length);
        const inputBuf = new Uint8Array(
          this.memory.buffer,
          this.inputPtr,
          chunk.length,
        );
        inputBuf.set(chunk);

        const ready = this.exports.streaming_lazyrow_decode(
          decoderId,
          chunk.length,
        );
        if (ready) {
          const outLen = this.exports.get_streaming_lazyrow_output(decoderId);
          if (outLen > 0) {
            const outputBuf = new Uint8Array(
              this.memory.buffer,
              this.getOutputPtr(),
              outLen,
            );
            yield outputBuf.slice();
            this.exports.clear_streaming_lazyrow_output(decoderId);
          }
        }
      }

      const outLen = this.exports.finish_streaming_lazyrow(decoderId);
      if (outLen > 0) {
        this.exports.get_streaming_lazyrow_output(decoderId);
        const outputBuf = new Uint8Array(
          this.memory.buffer,
          this.getOutputPtr(),
          outLen,
        );
        yield outputBuf.slice();
      }
    } finally {
      this.exports.destroy_streaming_lazyrow_decoder(decoderId);
    }
  }

  /**
   * Convert lazyrow binary format to record format using direct function.
   * Much faster than streaming decoder.
   */
  async *lazyRowToRecord(
    input: AsyncIterable<Uint8Array>,
  ): AsyncGenerator<Uint8Array> {
    let carryBuf = new Uint8Array(64 * 1024);
    let carryLen = 0;

    for await (const chunk of input) {
      if (chunk.length === 0) continue;

      // Ensure carry buffer can hold carry + chunk
      const needed = carryLen + chunk.length;
      if (needed > carryBuf.length) {
        const newBuf = new Uint8Array(Math.max(needed, carryBuf.length * 2));
        newBuf.set(carryBuf.subarray(0, carryLen));
        carryBuf = newBuf;
      }

      // Append chunk to carry buffer
      carryBuf.set(chunk, carryLen);
      const totalLen = carryLen + chunk.length;

      // Find complete LazyRow rows
      let pos = 0;
      let lastCompletePos = 0;

      while (pos + 4 <= totalLen) {
        // Read row_length
        const rowLength = carryBuf[pos] | (carryBuf[pos + 1] << 8) |
          (carryBuf[pos + 2] << 16) | (carryBuf[pos + 3] << 24);

        // Check if we have the complete row (row_length + 4 bytes for the length field itself)
        if (pos + 4 + rowLength > totalLen) {
          // Incomplete row, stop here
          break;
        }

        // Move to next row
        pos += 4 + rowLength;
        lastCompletePos = pos;
      }

      if (lastCompletePos > 0) {
        // Process complete rows
        this.ensureInputBuffer(lastCompletePos);
        new Uint8Array(this.memory.buffer, this.inputPtr, lastCompletePos).set(
          carryBuf.subarray(0, lastCompletePos),
        );

        this.ensureOutputBuffer(lastCompletePos + 4096);

        const outputLen = this.exports.lazyrow_to_record(
          this.inputPtr,
          lastCompletePos,
          this.getOutputPtr(),
          this.outputSize,
        );

        if (outputLen < 0) {
          throw new Error(
            "LazyRow to record conversion failed: output buffer too small",
          );
        }

        if (outputLen > 0) {
          yield new Uint8Array(
            this.memory.buffer,
            this.getOutputPtr(),
            outputLen,
          ).slice();
        }

        // Move incomplete row to start of buffer
        carryLen = totalLen - lastCompletePos;
        if (carryLen > 0) {
          carryBuf.copyWithin(0, lastCompletePos, totalLen);
        }
      } else {
        carryLen = totalLen;
      }
    }

    // Process remaining data
    if (carryLen > 0) {
      this.ensureInputBuffer(carryLen);
      new Uint8Array(this.memory.buffer, this.inputPtr, carryLen).set(
        carryBuf.subarray(0, carryLen),
      );

      this.ensureOutputBuffer(carryLen + 4096);

      const outputLen = this.exports.lazyrow_to_record(
        this.inputPtr,
        carryLen,
        this.getOutputPtr(),
        this.outputSize,
      );

      if (outputLen < 0) {
        throw new Error(
          "LazyRow to record conversion failed: output buffer too small",
        );
      }

      if (outputLen > 0) {
        yield new Uint8Array(this.memory.buffer, this.getOutputPtr(), outputLen)
          .slice();
      }
    }
  }

  async *recordToLazyRowBinaryStreaming(
    input: AsyncIterable<Uint8Array>,
  ): AsyncGenerator<Uint8Array> {
    let buffer = new Uint8Array(0);
    const RECORD_SEP = 0x1E;

    for await (const chunk of input) {
      const newBuf = new Uint8Array(buffer.length + chunk.length);
      newBuf.set(buffer);
      newBuf.set(chunk, buffer.length);
      buffer = newBuf;

      let lastRecordEnd = -1;
      for (let i = buffer.length - 1; i >= 0; i--) {
        if (buffer[i] === RECORD_SEP) {
          lastRecordEnd = i;
          break;
        }
      }

      if (lastRecordEnd >= 0) {
        const completeData = buffer.subarray(0, lastRecordEnd + 1);
        this.ensureInputBuffer(completeData.length);
        const inputBuf = new Uint8Array(
          this.memory.buffer,
          this.inputPtr,
          completeData.length,
        );
        inputBuf.set(completeData);

        // Ensure output buffer is large enough (input size + overhead for lazyrow format)
        this.ensureOutputBuffer(completeData.length + 4096);

        const outLen = this.exports.record_to_lazyrow(completeData.length);
        if (outLen > 0) {
          const outputBuf = new Uint8Array(
            this.memory.buffer,
            this.getOutputPtr(),
            outLen,
          );
          yield outputBuf.slice();
        }

        buffer = buffer.subarray(lastRecordEnd + 1);
      }
    }

    if (buffer.length > 0) {
      let lastRecordEnd = -1;
      for (let i = buffer.length - 1; i >= 0; i--) {
        if (buffer[i] === RECORD_SEP) {
          lastRecordEnd = i;
          break;
        }
      }

      if (lastRecordEnd >= 0) {
        const completeData = buffer.subarray(0, lastRecordEnd + 1);
        this.ensureInputBuffer(completeData.length);
        const inputBuf = new Uint8Array(
          this.memory.buffer,
          this.inputPtr,
          completeData.length,
        );
        inputBuf.set(completeData);

        // Ensure output buffer is large enough (input size + overhead for lazyrow format)
        this.ensureOutputBuffer(completeData.length + 4096);

        const outLen = this.exports.record_to_lazyrow(completeData.length);
        if (outLen > 0) {
          const outputBuf = new Uint8Array(
            this.memory.buffer,
            this.getOutputPtr(),
            outLen,
          );
          yield outputBuf.slice();
        }
      }
    }
  }

  /**
   * Convert binary lazyrow format directly to CSV (single-shot).
   *
   * Takes binary lazyrow data and converts to CSV in one WASM call.
   * Much faster than streaming for batch operations.
   *
   * @param binaryData - Binary lazyrow data with row_length prefixes
   * @param separator - CSV separator character code (44 for comma)
   * @param crlf - Use CRLF line endings if true
   * @returns CSV data as Uint8Array
   */
  lazyRowBinaryToCsvDirect(
    binaryData: Uint8Array,
    separator: number,
    crlf: boolean,
  ): Uint8Array {
    this.ensureInputBuffer(binaryData.length);
    this.ensureOutputBuffer(binaryData.length * 2); // Estimate 2x for CSV overhead

    new Uint8Array(this.memory.buffer, this.inputPtr, binaryData.length).set(
      binaryData,
    );

    const outputLen = this.exports.lazyrow_to_csv(
      this.inputPtr,
      binaryData.length,
      this.getOutputPtr(),
      this.outputSize,
      separator,
      crlf ? 1 : 0,
    );

    if (outputLen < 0) {
      throw new Error("lazyrow_to_csv failed: output buffer too small");
    }

    return new Uint8Array(this.memory.buffer, this.getOutputPtr(), outputLen)
      .slice();
  }

  /**
   * Convert record format data directly to CSV in one shot.
   * Much faster than streaming for batched data.
   *
   * @param recordData - Record format data (fields separated by \x1F, records by \x1E)
   * @param separator - CSV separator character code (44 for comma)
   * @param crlf - Use CRLF line endings if true
   * @returns CSV data as Uint8Array
   */
  recordToCsvDirect(
    recordData: Uint8Array,
    separator: number,
    crlf: boolean,
  ): Uint8Array {
    this.ensureInputBuffer(recordData.length);
    this.ensureOutputBuffer(recordData.length * 2); // Estimate 2x for CSV overhead

    new Uint8Array(this.memory.buffer, this.inputPtr, recordData.length).set(
      recordData,
    );

    const outputLen = this.exports.record_to_csv(
      this.inputPtr,
      recordData.length,
      this.getOutputPtr(),
      this.outputSize,
      separator,
      0, // alwaysQuote = false
      crlf ? 1 : 0,
    );

    if (outputLen < 0) {
      throw new Error("record_to_csv failed: output buffer too small");
    }

    return new Uint8Array(this.memory.buffer, this.getOutputPtr(), outputLen)
      .slice();
  }

  recordToLazyRowBinaryDirect(recordData: Uint8Array): Uint8Array {
    this.ensureInputBuffer(recordData.length);

    // Binary lazyrow has significant overhead for headers
    // Use 20x to handle worst case (many small fields)
    const outputSize = recordData.length * 20;
    this.ensureOutputBuffer(outputSize);

    new Uint8Array(this.memory.buffer, this.inputPtr, recordData.length).set(
      recordData,
    );

    const outputLen = this.exports.record_to_lazyrow(recordData.length);

    if (outputLen < 0) {
      throw new Error(
        `record_to_lazyrow failed: output buffer too small (input=${recordData.length}, capacity=${this.outputSize})`,
      );
    }

    return new Uint8Array(this.memory.buffer, this.getOutputPtr(), outputLen)
      .slice();
  }
}
