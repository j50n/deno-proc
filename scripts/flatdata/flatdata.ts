#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * flatdata - Tabular data format converter
 * 
 * Converts between CSV, TSV, record, and lazyrow formats.
 * Use with proc to offload parsing to a separate process.
 */

import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
import denoJson from "../../deno.json" with { type: "json" };

type Writer = (data: Uint8Array) => Promise<number>;

// =============================================================================
// WASM Setup
// =============================================================================

let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

async function initWasm(): Promise<void> {
  if (wasmInstance) return;
  
  const wasmUrl = new URL("../../wasm/flatdata.wasm", import.meta.url);
  const wasmBytes = await Deno.readFile(wasmUrl);
  wasmMemory = new WebAssembly.Memory({ initial: 256, maximum: 1024 });
  
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    env: { memory: wasmMemory },
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
  
  wasmInstance = instance;
}

// =============================================================================
// I/O Helpers
// =============================================================================

async function getInput(file?: string): Promise<ReadableStream<Uint8Array>> {
  if (file) {
    return (await Deno.open(file, { read: true })).readable;
  }
  return Deno.stdin.readable;
}

async function getWriter(file?: string): Promise<{ write: Writer; close: () => void }> {
  if (file) {
    const f = await Deno.open(file, { write: true, create: true, truncate: true });
    return { write: (d) => f.write(d), close: () => f.close() };
  }
  return { write: (d) => Deno.stdout.write(d), close: () => {} };
}

// =============================================================================
// CSV/TSV to Record (WASM fast path)
// =============================================================================

async function delimitedToRecord(
  input: ReadableStream<Uint8Array>,
  write: Writer,
  separator: number,
): Promise<void> {
  await initWasm();
  const exp = wasmInstance!.exports as any;
  const memory = wasmMemory!;
  
  const CHUNK = 64 * 1024;
  const inputPtr = exp.alloc_input_buffer(CHUNK);
  const outputPtr = exp.alloc_output_buffer(CHUNK * 2);
  const parserId = exp.create_direct_parser(separator, 0);
  
  const reader = input.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      for (let off = 0; off < value.length; off += CHUNK) {
        const slice = value.subarray(off, Math.min(off + CHUNK, value.length));
        new Uint8Array(memory.buffer, inputPtr, slice.length).set(slice);
        
        const outLen = exp.parse_direct(parserId, slice.length);
        if (outLen > 0) {
          await write(new Uint8Array(memory.buffer, outputPtr, outLen));
        }
      }
    }
    
    const finalLen = exp.finish_direct(parserId);
    if (finalLen > 0) {
      await write(new Uint8Array(memory.buffer, outputPtr, finalLen));
    }
  } finally {
    exp.destroy_direct_parser(parserId);
  }
}

// =============================================================================
// Record to CSV/TSV (WASM)
// =============================================================================

async function recordToDelimitedWasm(
  input: ReadableStream<Uint8Array>,
  write: Writer,
  separator: number,
  quoteAll: boolean,
): Promise<void> {
  await initWasm();
  const exp = wasmInstance!.exports as any;
  const memory = wasmMemory!;
  
  const CHUNK_SIZE = 64 * 1024;
  const inputPtr = exp.alloc_input_buffer(CHUNK_SIZE);
  const outputPtr = exp.alloc_output_buffer(CHUNK_SIZE * 4);
  
  const stringifierId = exp.create_delimited_stringifier(separator, 0, quoteAll ? 1 : 0, 0);
  const reader = input.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      for (let off = 0; off < value.length; off += CHUNK_SIZE) {
        const slice = value.subarray(off, Math.min(off + CHUNK_SIZE, value.length));
        new Uint8Array(memory.buffer, inputPtr, slice.length).set(slice);
        
        exp.stringify_delimited(stringifierId, slice.length);
        
        const outLen = exp.get_stringify_output(stringifierId);
        if (outLen > 0) {
          const output = new Uint8Array(memory.buffer, outputPtr, outLen);
          await write(output.slice());
          exp.clear_stringify_output(stringifierId);
        }
      }
    }
    
    // Get any remaining output
    const outLen = exp.get_stringify_output(stringifierId);
    if (outLen > 0) {
      const output = new Uint8Array(memory.buffer, outputPtr, outLen);
      await write(output.slice());
    }
  } finally {
    exp.destroy_delimited_stringifier(stringifierId);
  }
}

// =============================================================================
// Binary LazyRow Format
// =============================================================================

const FIELD_SEP = 0x1F;
const RECORD_SEP = 0x1E;
const encoder = new TextEncoder();

/**
 * Convert CSV/TSV to binary lazyrow format.
 * Binary format: [row_len:u32][field_count:u32][field_lens:u32[]][field_data]
 */
async function delimitedToLazyRowBinary(
  input: ReadableStream<Uint8Array>,
  write: Writer,
  separator: number,
): Promise<void> {
  await initWasm();
  const exp = wasmInstance!.exports as any;
  const memory = wasmMemory!;

  const CHUNK = 64 * 1024;
  const inputPtr = exp.alloc_input_buffer(CHUNK);
  const outputPtr = exp.alloc_output_buffer(CHUNK * 2);
  const parserId = exp.create_direct_parser(separator, 0);

  const reader = input.getReader();
  let recordBuffer = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (let off = 0; off < value.length; off += CHUNK) {
        const slice = value.subarray(off, Math.min(off + CHUNK, value.length));
        new Uint8Array(memory.buffer, inputPtr, slice.length).set(slice);

        const outLen = exp.parse_direct(parserId, slice.length);
        if (outLen > 0) {
          const recordData = new Uint8Array(memory.buffer, outputPtr, outLen);
          await processRecordChunk(recordData, recordBuffer, write);
          recordBuffer = new Uint8Array(0);
        }
      }
    }

    const finalLen = exp.finish_direct(parserId);
    if (finalLen > 0) {
      const recordData = new Uint8Array(memory.buffer, outputPtr, finalLen);
      await processRecordChunk(recordData, recordBuffer, write);
    }
  } finally {
    exp.destroy_direct_parser(parserId);
  }
}

async function processRecordChunk(
  data: Uint8Array,
  _leftover: Uint8Array,
  write: Writer,
): Promise<void> {
  // Parse record format and convert to binary lazyrow
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === RECORD_SEP) {
      const record = data.subarray(start, i);
      await writeRowAsBinary(record, write);
      start = i + 1;
    }
  }
}

async function writeRowAsBinary(record: Uint8Array, write: Writer): Promise<void> {
  // Split on FIELD_SEP to get fields
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
 * Convert binary lazyrow format to record format for stringifier.
 */
async function lazyRowBinaryToDelimited(
  input: ReadableStream<Uint8Array>,
  write: Writer,
  separator: number,
  quoteAll: boolean,
): Promise<void> {
  await initWasm();
  const exp = wasmInstance!.exports as any;
  const memory = wasmMemory!;

  const CHUNK_SIZE = 64 * 1024;
  const inputPtr = exp.alloc_input_buffer(CHUNK_SIZE);
  const outputPtr = exp.alloc_output_buffer(CHUNK_SIZE * 4);
  const stringifierId = exp.create_delimited_stringifier(separator, 0, quoteAll ? 1 : 0, 0);

  const reader = input.getReader();
  let buffer = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append to buffer
      const newBuf = new Uint8Array(buffer.length + value.length);
      newBuf.set(buffer);
      newBuf.set(value, buffer.length);
      buffer = newBuf;

      // Process complete rows
      while (buffer.length >= 4) {
        const view = new DataView(buffer.buffer, buffer.byteOffset);
        const rowLength = view.getUint32(0, true);

        if (buffer.length < 4 + rowLength) break;

        // Convert binary row to record format
        const rowData = buffer.subarray(4, 4 + rowLength);
        const recordData = binaryRowToRecord(rowData);

        // Feed to stringifier
        new Uint8Array(memory.buffer, inputPtr, recordData.length).set(recordData);
        exp.stringify_delimited(stringifierId, recordData.length);

        const outLen = exp.get_stringify_output(stringifierId);
        if (outLen > 0) {
          await write(new Uint8Array(memory.buffer, outputPtr, outLen).slice());
          exp.clear_stringify_output(stringifierId);
        }

        buffer = buffer.subarray(4 + rowLength);
      }
    }

    // Final output
    const outLen = exp.get_stringify_output(stringifierId);
    if (outLen > 0) {
      await write(new Uint8Array(memory.buffer, outputPtr, outLen).slice());
    }
  } finally {
    exp.destroy_delimited_stringifier(stringifierId);
  }
}

function binaryRowToRecord(rowData: Uint8Array): Uint8Array {
  const view = new DataView(rowData.buffer, rowData.byteOffset);
  const fieldCount = view.getUint32(0, true);

  // Read field lengths and compute offsets
  const fieldLengths: number[] = [];
  for (let i = 0; i < fieldCount; i++) {
    fieldLengths.push(view.getUint32(4 + i * 4, true));
  }

  const dataStart = 4 + fieldCount * 4;
  const totalDataLen = fieldLengths.reduce((a, b) => a + b, 0);
  const outputLen = totalDataLen + fieldCount; // fields + separators

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

/**
 * Convert record format to binary lazyrow format.
 */
async function recordToLazyRowBinary(
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
        await writeRowAsBinary(record, write);
        start = i + 1;
      }
    }
    buffer = buffer.subarray(start);
  }

  if (buffer.length > 0) {
    await writeRowAsBinary(buffer, write);
  }
}

/**
 * Convert binary lazyrow format to record format.
 */
async function lazyRowBinaryToRecord(
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
      const recordData = binaryRowToRecord(rowData);
      await write(recordData);

      buffer = buffer.subarray(4 + rowLength);
    }
  }
}

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
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await delimitedToRecord(stream, write, separator!.charCodeAt(0));
    close();
  });

const csv2lazyrow = new Command()
  .description("Convert CSV to binary lazyrow format")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await delimitedToLazyRowBinary(stream, write, separator!.charCodeAt(0));
    close();
  });

// TSV input commands
const tsv2record = new Command()
  .description("Convert TSV to record format (\\x1F/\\x1E delimited)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "cat data.tsv | flatdata tsv2record")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await delimitedToRecord(stream, write, 9);
    close();
  });

const tsv2lazyrow = new Command()
  .description("Convert TSV to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await delimitedToLazyRowBinary(stream, write, 9);
    close();
  });

// Record output commands
const record2csv = new Command()
  .description("Convert record format to CSV")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-q, --quote-all", "Quote all fields, not just those requiring it")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2csv < data.rec > data.csv")
  .example("Pipeline", "cat huge.csv | flatdata csv2record | process | flatdata record2csv")
  .action(async ({ separator, quoteAll, input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await recordToDelimitedWasm(stream, write, separator!.charCodeAt(0), quoteAll ?? false);
    close();
  });

const record2tsv = new Command()
  .description("Convert record format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .example("Basic", "flatdata record2tsv < data.rec > data.tsv")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await recordToDelimitedWasm(stream, write, 9, false);
    close();
  });

// Lazyrow output commands (binary format)
const lazyrow2csv = new Command()
  .description("Convert binary lazyrow format to CSV")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-q, --quote-all", "Quote all fields, not just those requiring it")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, quoteAll, input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await lazyRowBinaryToDelimited(stream, write, separator!.charCodeAt(0), quoteAll ?? false);
    close();
  });

const lazyrow2tsv = new Command()
  .description("Convert binary lazyrow format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await lazyRowBinaryToDelimited(stream, write, 9, false);
    close();
  });

// Record <-> Lazyrow conversion commands
const record2lazyrow = new Command()
  .description("Convert record format to binary lazyrow format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await recordToLazyRowBinary(stream, write);
    close();
  });

const lazyrow2record = new Command()
  .description("Convert binary lazyrow format to record format")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await lazyRowBinaryToRecord(stream, write);
    close();
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
  lazyrow  Binary format with length-prefixed fields for efficient random access

Uses WebAssembly for high-performance parsing (~100+ MB/s).`)
  .example("CSV to record", "cat data.csv | flatdata csv2record | ./process")
  .example("Record to CSV", "flatdata record2csv -d ';' < data.rec > euro.csv")
  .example("Full pipeline", "flatdata csv2record -i huge.csv | ./analyze | flatdata record2csv -o results.csv")
  .command("csv2record", csv2record)
  .command("csv2lazyrow", csv2lazyrow)
  .command("tsv2record", tsv2record)
  .command("tsv2lazyrow", tsv2lazyrow)
  .command("record2csv", record2csv)
  .command("record2tsv", record2tsv)
  .command("record2lazyrow", record2lazyrow)
  .command("lazyrow2csv", lazyrow2csv)
  .command("lazyrow2tsv", lazyrow2tsv)
  .command("lazyrow2record", lazyrow2record)
  .parse(Deno.args);
