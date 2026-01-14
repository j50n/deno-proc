/**
 * Unified wrapper for flatdata.wasm operations.
 * 
 * This module provides a high-level TypeScript interface to the flatdata WebAssembly module,
 * which implements high-performance CSV/TSV parsing and stringification using Odin.
 * 
 * The processor handles all WASM memory management, buffer allocation, and lifecycle
 * management internally, exposing clean async methods for data conversion.
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
 * @returns Number of bytes written
 */
type Writer = (data: Uint8Array) => Promise<number>;

/**
 * WebAssembly exports interface for flatdata.wasm.
 * These are the raw WASM functions exposed by the Odin-compiled module.
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
 * Unified processor for all flatdata WASM operations.
 * 
 * Provides high-level methods for converting between CSV, TSV, record format,
 * and binary lazyrow format. Handles all WASM memory management internally.
 * 
 * @example
 * ```ts
 * const processor = await FlatdataProcessor.create();
 * await processor.csvToRecord(inputStream, writeFunction, 44); // comma separator
 * ```
 */
export class FlatdataProcessor {
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
   * Loads the WASM module, initializes memory, and allocates buffers.
   * 
   * @returns A ready-to-use processor instance
   */
  static async create(): Promise<FlatdataProcessor> {
    const wasmUrl = new URL("../../wasm/flatdata.wasm", import.meta.url);
    const wasmBytes = await Deno.readFile(wasmUrl);
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 1024 });

    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      env: { memory },
      odin_env: {
        sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
        atan: Math.atan, atan2: Math.atan2, sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp,
        ln: Math.log, log10: Math.log10, log2: Math.log2, floor: Math.floor, ceil: Math.ceil,
        round: Math.round, trunc: Math.trunc, abs: Math.abs, sinh: Math.sinh, cosh: Math.cosh,
        tanh: Math.tanh, ldexp: (x: number, e: number) => x * Math.pow(2, e),
        fmuladd: (x: number, y: number, z: number) => x * y + z,
        write: () => 0, trap: () => {}, abort: () => {}, alert: () => {},
        evaluate: () => {}, time_now: () => 0n, tick_now: () => 0, time_sleep: () => {},
        rand_bytes: () => {},
      },
    });

    const processor = new FlatdataProcessor(instance.exports as unknown as WasmExports, memory);
    processor.allocateBuffers();
    return processor;
  }

  /**
   * Allocate input and output buffers in WASM memory.
   * Called automatically during initialization.
   */
  private allocateBuffers(): void {
    const CHUNK = 64 * 1024;
    this.inputPtr = this.exports.alloc_input_buffer(CHUNK);
    this.outputPtr = this.exports.alloc_output_buffer(CHUNK * 2);
  }

  /**
   * Convert CSV/TSV to record format (\x1F/\x1E delimited).
   * 
   * Uses the direct parser for maximum streaming performance. Output is written
   * directly to the output buffer without intermediate copies.
   * 
   * Record format uses:
   * - \x1F (Unit Separator) between fields
   * - \x1E (Record Separator) between rows
   * 
   * @param input - Readable stream of CSV/TSV bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   * 
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   * await processor.csvToRecord(stream, write, 44); // CSV
   * await processor.csvToRecord(stream, write, 9);  // TSV
   * ```
   */
  async csvToRecord(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
  ): Promise<void> {
    const CHUNK = 64 * 1024;
    const parserId = this.exports.create_direct_parser(separator, 0);
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (let off = 0; off < value.length; off += CHUNK) {
          const slice = value.subarray(off, Math.min(off + CHUNK, value.length));
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
   * @param input - Readable stream of record format bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   * @param quoteAll - If true, quote all fields; if false, only quote when necessary
   * 
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   * await processor.recordToCsv(stream, write, 44, false); // CSV with minimal quoting
   * await processor.recordToCsv(stream, write, 9, false);  // TSV
   * ```
   */
  async recordToCsv(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
    quoteAll: boolean,
  ): Promise<void> {
    const CHUNK_SIZE = 64 * 1024;
    const stringifierId = this.exports.create_delimited_stringifier(separator, 0, quoteAll ? 1 : 0, 0);
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (let off = 0; off < value.length; off += CHUNK_SIZE) {
          const slice = value.subarray(off, Math.min(off + CHUNK_SIZE, value.length));
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

  /**
   * Convert CSV/TSV to binary lazyrow format.
   * 
   * Binary lazyrow format is optimized for random field access without parsing.
   * Each row is encoded as:
   * - [row_length: u32] Total bytes for this row
   * - [field_count: u32] Number of fields
   * - [field_lengths: u32[]] Length of each field
   * - [field_data: bytes] Concatenated field data
   * 
   * This format allows O(1) access to any field by index without string parsing.
   * 
   * @param input - Readable stream of CSV/TSV bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   * 
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   * await processor.csvToLazyRowBinary(stream, write, 44);
   * ```
   */
  async csvToLazyRowBinary(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
  ): Promise<void> {
    const CHUNK = 64 * 1024;
    const parserId = this.exports.create_direct_parser(separator, 0);
    const reader = input.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (let off = 0; off < value.length; off += CHUNK) {
          const slice = value.subarray(off, Math.min(off + CHUNK, value.length));
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
   * Process a chunk of record format data and convert to binary lazyrow.
   * Internal helper method.
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
   * Internal helper method.
   * 
   * @param record - Record format row (fields separated by \x1F)
   * @param write - Writer function for output
   */
  private async writeRowAsBinary(record: Uint8Array, write: Writer): Promise<void> {
    const fields: Uint8Array[] = [];
    let fieldStart = 0;
    for (let i = 0; i <= record.length; i++) {
      if (i === record.length || record[i] === FIELD_SEP) {
        fields.push(record.subarray(fieldStart, i));
        fieldStart = i + 1;
      }
    }

    const fieldCount = fields.length;
    const dataSize = fields.reduce((sum, f) => sum + f.length, 0);
    const headerSize = 4 + fieldCount * 4;
    const rowLength = headerSize + dataSize;

    const buffer = new Uint8Array(4 + rowLength);
    const view = new DataView(buffer.buffer);

    view.setUint32(0, rowLength, true);
    view.setUint32(4, fieldCount, true);

    let offset = 8 + fieldCount * 4;
    for (let i = 0; i < fieldCount; i++) {
      view.setUint32(8 + i * 4, fields[i].length, true);
      buffer.set(fields[i], offset);
      offset += fields[i].length;
    }

    await write(buffer);
  }

  /**
   * Convert binary lazyrow format to CSV/TSV.
   * 
   * Reads binary lazyrow format and converts to standard CSV/TSV with proper
   * quoting and escaping. Handles partial rows across chunk boundaries.
   * 
   * @param input - Readable stream of binary lazyrow bytes
   * @param write - Writer function for output chunks
   * @param separator - Field separator character code (44 for comma, 9 for tab)
   * @param quoteAll - If true, quote all fields; if false, only quote when necessary
   * 
   * @example
   * ```ts
   * const processor = await FlatdataProcessor.create();
   * await processor.lazyRowBinaryToCsv(stream, write, 44, false);
   * ```
   */
  async lazyRowBinaryToCsv(
    input: ReadableStream<Uint8Array>,
    write: Writer,
    separator: number,
    quoteAll: boolean,
  ): Promise<void> {
    const CHUNK_SIZE = 64 * 1024;
    const stringifierId = this.exports.create_delimited_stringifier(separator, 0, quoteAll ? 1 : 0, 0);
    const reader = input.getReader();
    let buffer = new Uint8Array(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const newBuf = new Uint8Array(buffer.length + value.length);
        newBuf.set(buffer);
        newBuf.set(value, buffer.length);
        buffer = newBuf;

        while (buffer.length >= 4) {
          const view = new DataView(buffer.buffer, buffer.byteOffset);
          const rowLength = view.getUint32(0, true);

          if (buffer.length < 4 + rowLength) break;

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

      const outLen = this.exports.get_stringify_output(stringifierId);
      if (outLen > 0) {
        await write(new Uint8Array(this.memory.buffer, this.outputPtr, outLen).slice());
      }
    } finally {
      this.exports.destroy_delimited_stringifier(stringifierId);
    }
  }

  /**
   * Convert record format to binary lazyrow format.
   * 
   * Takes record format (\x1F/\x1E delimited) and converts to binary lazyrow
   * format for efficient random field access. Handles partial records across
   * chunk boundaries.
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

      const newBuf = new Uint8Array(buffer.length + value.length);
      newBuf.set(buffer);
      newBuf.set(value, buffer.length);
      buffer = newBuf;

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

      const newBuf = new Uint8Array(buffer.length + value.length);
      newBuf.set(buffer);
      newBuf.set(value, buffer.length);
      buffer = newBuf;

      while (buffer.length >= 4) {
        const view = new DataView(buffer.buffer, buffer.byteOffset);
        const rowLength = view.getUint32(0, true);

        if (buffer.length < 4 + rowLength) break;

        const rowData = buffer.subarray(4, 4 + rowLength);
        const recordData = this.binaryRowToRecord(rowData);
        await write(recordData);

        buffer = buffer.subarray(4 + rowLength);
      }
    }
  }

  /**
   * Convert a single binary lazyrow to record format.
   * Internal helper method.
   * 
   * @param rowData - Binary lazyrow data for one row
   * @returns Record format bytes (\x1F/\x1E delimited)
   */
  private binaryRowToRecord(rowData: Uint8Array): Uint8Array {
    const view = new DataView(rowData.buffer, rowData.byteOffset);
    const fieldCount = view.getUint32(0, true);

    const fieldLengths: number[] = [];
    for (let i = 0; i < fieldCount; i++) {
      fieldLengths.push(view.getUint32(4 + i * 4, true));
    }

    const dataStart = 4 + fieldCount * 4;
    const totalDataLen = fieldLengths.reduce((a, b) => a + b, 0);
    const outputLen = totalDataLen + fieldCount;

    const output = new Uint8Array(outputLen);
    let readOff = dataStart;
    let writeOff = 0;

    for (let i = 0; i < fieldCount; i++) {
      const len = fieldLengths[i];
      output.set(rowData.subarray(readOff, readOff + len), writeOff);
      readOff += len;
      writeOff += len;
      output[writeOff++] = i < fieldCount - 1 ? FIELD_SEP : RECORD_SEP;
    }

    return output;
  }
}
