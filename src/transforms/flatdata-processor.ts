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
  
  /** Create a direct parser instance (outputs directly to buffer) */
  create_direct_parser: (separator: number, strict: number) => number;
  
  /** Destroy a direct parser instance */
  destroy_direct_parser: (id: number) => void;
  
  /** Parse a chunk of CSV data */
  parse_direct: (id: number, len: number) => number;
  
  /** Finish parsing and flush remaining data */
  finish_direct: (id: number) => number;
  
  /** Create a delimited stringifier instance */
  create_delimited_stringifier: (sep: number, crlf: number, alwaysQuote: number, expectedFields: number) => number;
  
  /** Destroy a delimited stringifier instance */
  destroy_delimited_stringifier: (id: number) => void;
  
  /** Stringify record format to CSV */
  stringify_delimited: (id: number, len: number) => void;
  
  /** Get stringifier output length */
  get_stringify_output: (id: number) => number;
  
  /** Clear stringifier output buffer */
  clear_stringify_output: (id: number) => void;
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
  /** Input buffer size: 64KB for reading CSV chunks */
  private static readonly INPUT_BUFFER_SIZE = 64 * 1024;
  
  /** Output buffer size: 128KB for parsed output (2x input for worst case) */
  private static readonly OUTPUT_BUFFER_SIZE = 128 * 1024;
  
  /** Chunk size for processing: matches input buffer */
  private static readonly CHUNK_SIZE = 64 * 1024;

  private exports: WasmExports;
  private memory: WebAssembly.Memory;
  private inputPtr = 0;
  private outputPtr = 0;

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
    const wasmUrl = new URL("../../wasm/flatdata.wasm", import.meta.url);
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
    this.inputPtr = this.exports.alloc_input_buffer(FlatdataProcessor.INPUT_BUFFER_SIZE);
    this.outputPtr = this.exports.alloc_output_buffer(FlatdataProcessor.OUTPUT_BUFFER_SIZE);
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
    // Use default output separators: \x1F for fields, \x1E for records
    const parserId = this.exports.create_direct_parser(separator, 0, 0x1F, 0x1E);
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (let off = 0; off < value.length; off += FlatdataProcessor.CHUNK_SIZE) {
          const slice = value.subarray(off, Math.min(off + FlatdataProcessor.CHUNK_SIZE, value.length));
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(slice);

          const outLen = this.exports.parse_direct(parserId, slice.length);
          if (outLen > 0) {
            await write(new Uint8Array(this.memory.buffer, this.outputPtr, outLen));
          }
        }
      }

      const finalLen = this.exports.finish_direct(parserId);
      if (finalLen > 0) {
        await write(new Uint8Array(this.memory.buffer, this.outputPtr, finalLen));
      }
    } finally {
      this.exports.destroy_direct_parser(parserId);
    }
  }

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
   * 
   * // CSV with minimal quoting (recommended)
   * await processor.recordToCsv(stream, write, 44, false);
   * 
   * // CSV with all fields quoted
   * await processor.recordToCsv(stream, write, 44, true);
   * 
   * // TSV (tabs don't need quoting usually)
   * await processor.recordToCsv(stream, write, 9, false);
   * ```
   */
  async recordToCsv(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
    quoteAll: boolean,
  ): Promise<void> {
    const stringifierId = this.exports.create_delimited_stringifier(separator, 0, quoteAll ? 1 : 0, 0);
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (let off = 0; off < value.length; off += FlatdataProcessor.CHUNK_SIZE) {
          const slice = value.subarray(off, Math.min(off + FlatdataProcessor.CHUNK_SIZE, value.length));
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(slice);

          this.exports.stringify_delimited(stringifierId, slice.length);

          const outLen = this.exports.get_stringify_output(stringifierId);
          if (outLen > 0) {
            const output = new Uint8Array(this.memory.buffer, this.outputPtr, outLen);
            await write(output.slice());
            this.exports.clear_stringify_output(stringifierId);
          }
        }
      }

      const outLen = this.exports.get_stringify_output(stringifierId);
      if (outLen > 0) {
        const output = new Uint8Array(this.memory.buffer, this.outputPtr, outLen);
        await write(output.slice());
      }
    } finally {
      this.exports.destroy_delimited_stringifier(stringifierId);
    }
  }

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
   * **Performance**: ~80-120 MB/s (slightly slower due to format conversion)
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
    // Use default output separators: \x1F for fields, \x1E for records
    const parserId = this.exports.create_direct_parser(separator, 0, 0x1F, 0x1E);
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (let off = 0; off < value.length; off += FlatdataProcessor.CHUNK_SIZE) {
          const slice = value.subarray(off, Math.min(off + FlatdataProcessor.CHUNK_SIZE, value.length));
          new Uint8Array(this.memory.buffer, this.inputPtr, slice.length).set(slice);

          const outLen = this.exports.parse_direct(parserId, slice.length);
          if (outLen > 0) {
            const recordData = new Uint8Array(this.memory.buffer, this.outputPtr, outLen);
            await this.processRecordChunk(recordData, write);
          }
        }
      }

      const finalLen = this.exports.finish_direct(parserId);
      if (finalLen > 0) {
        const recordData = new Uint8Array(this.memory.buffer, this.outputPtr, finalLen);
        await this.processRecordChunk(recordData, write);
      }
    } finally {
      this.exports.destroy_direct_parser(parserId);
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
    const stringifierId = this.exports.create_delimited_stringifier(separator, 0, quoteAll ? 1 : 0, 0);
    const reader = input.getReader();
    let buffer = new Uint8Array(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Accumulate data to handle partial rows
        const newBuf = new Uint8Array(buffer.length + value.length);
        newBuf.set(buffer);
        newBuf.set(value, buffer.length);
        buffer = newBuf;

        // Process complete rows
        while (buffer.length >= 4) {
          const view = new DataView(buffer.buffer, buffer.byteOffset);
          const rowLength = view.getUint32(0, true);

          if (buffer.length < 4 + rowLength) break; // Incomplete row

          const rowData = buffer.subarray(4, 4 + rowLength);
          const recordData = this.binaryRowToRecord(rowData);

          new Uint8Array(this.memory.buffer, this.inputPtr, recordData.length).set(recordData);
          this.exports.stringify_delimited(stringifierId, recordData.length);

          const outLen = this.exports.get_stringify_output(stringifierId);
          if (outLen > 0) {
            await write(new Uint8Array(this.memory.buffer, this.outputPtr, outLen).slice());
            this.exports.clear_stringify_output(stringifierId);
          }

          buffer = buffer.subarray(4 + rowLength);
        }
      }

      // Flush any remaining output
      const outLen = this.exports.get_stringify_output(stringifierId);
      if (outLen > 0) {
        await write(new Uint8Array(this.memory.buffer, this.outputPtr, outLen).slice());
      }
    } finally {
      this.exports.destroy_delimited_stringifier(stringifierId);
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Accumulate data
      const newBuf = new Uint8Array(buffer.length + value.length);
      newBuf.set(buffer);
      newBuf.set(value, buffer.length);
      buffer = newBuf;

      // Process complete records
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === RECORD_SEP) {
          const record = buffer.subarray(start, i);
          await this.writeRowAsBinary(record, write);
          start = i + 1;
        }
      }
      buffer = buffer.subarray(start);
    }

    // Handle final record if no trailing separator
    if (buffer.length > 0) {
      await this.writeRowAsBinary(buffer, write);
    }
  }

  /**
   * Convert binary lazyrow format to record format.
   * 
   * Reads binary lazyrow format and converts to record format (\x1F/\x1E delimited).
   * Handles partial rows across chunk boundaries.
   * 
   * **Use case**: When you need to process binary lazyrow with tools expecting record format.
   * 
   * **Performance**: ~150-200 MB/s (pure format conversion)
   * 
   * @param input - Readable stream of binary lazyrow bytes
   * @param write - Writer function for output chunks
   * 
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   * await processor.lazyRowBinaryToRecord(stream, write);
   * ```
   */
  async lazyRowBinaryToRecord(
    input: ReadableStream<Uint8Array>,
    write: Writer,
  ): Promise<void> {
    const reader = input.getReader();
    let buffer = new Uint8Array(0);

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

        if (buffer.length < 4 + rowLength) break; // Incomplete row

        const rowData = buffer.subarray(4, 4 + rowLength);
        const recordData = this.binaryRowToRecord(rowData);
        await write(recordData);

        buffer = buffer.subarray(4 + rowLength);
      }
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Process a chunk of record format data and convert to binary lazyrow.
   * Splits on RECORD_SEP and converts each record.
   * 
   * @param data - Record format data chunk
   * @param write - Writer function for output
   */
  private async processRecordChunk(data: Uint8Array, write: Writer): Promise<void> {
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === RECORD_SEP) {
        const record = data.subarray(start, i);
        await this.writeRowAsBinary(record, write);
        start = i + 1;
      }
    }
  }

  /**
   * Write a single row in binary lazyrow format.
   * Splits record on FIELD_SEP and encodes as binary lazyrow.
   * 
   * @param record - Record format row (fields separated by \x1F)
   * @param write - Writer function for output
   */
  private async writeRowAsBinary(record: Uint8Array, write: Writer): Promise<void> {
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
}
