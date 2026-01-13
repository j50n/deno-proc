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
  .description("Convert CSV to lazyrow format (same as record, row-at-a-time)")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await delimitedToRecord(stream, write, separator!.charCodeAt(0));
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
  .description("Convert TSV to lazyrow format (same as record, row-at-a-time)")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await delimitedToRecord(stream, write, 9);
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

// Lazyrow output commands (same as record)
const lazyrow2csv = new Command()
  .description("Convert lazyrow format to CSV")
  .option("-d, --separator <char:string>", "Field separator", { default: "," })
  .option("-q, --quote-all", "Quote all fields, not just those requiring it")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ separator, quoteAll, input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await recordToDelimitedWasm(stream, write, separator!.charCodeAt(0), quoteAll ?? false);
    close();
  });

const lazyrow2tsv = new Command()
  .description("Convert lazyrow format to TSV")
  .option("-i, --input <file:string>", "Input file (default: stdin)")
  .option("-o, --output <file:string>", "Output file (default: stdout)")
  .action(async ({ input, output }) => {
    const stream = await getInput(input);
    const { write, close } = await getWriter(output);
    await recordToDelimitedWasm(stream, write, 9, false);
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
  record   Binary format using \\x1F (field) and \\x1E (record) separators
  lazyrow  Same as record (semantic alias for streaming row access)

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
  .command("lazyrow2csv", lazyrow2csv)
  .command("lazyrow2tsv", lazyrow2tsv)
  .parse(Deno.args);
