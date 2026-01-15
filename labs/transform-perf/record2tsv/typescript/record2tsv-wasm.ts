/**
 * Record2TSV WASM Transformer
 *
 * Wraps the Odin WASM module for record→TSV transformation.
 * Manages memory allocation and provides a clean async generator interface.
 */

import { OdinRuntime } from "./odin-runtime.ts";

export class Record2TsvWasm {
  private wasm: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private bufferPtr: number = 0;
  private bufferCapacity: number = 0;

  private constructor(wasm: WebAssembly.Instance, memory: WebAssembly.Memory) {
    this.wasm = wasm;
    this.memory = memory;
  }

  /**
   * Load and instantiate the WASM module
   */
  static async create(): Promise<Record2TsvWasm> {
    const wasmPath =
      new URL("../odin/record2tsv.wasm", import.meta.url).pathname;
    const wasmBytes = await Deno.readFile(wasmPath);
    const wasmModule = await WebAssembly.compile(wasmBytes);

    const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
    const runtime = new OdinRuntime(memory);

    const instance = await WebAssembly.instantiate(wasmModule, {
      env: { memory },
      odin_env: runtime.env,
    });

    return new Record2TsvWasm(instance, memory);
  }

  /**
   * Transform a single chunk in-place
   */
  transform(chunk: Uint8Array): Uint8Array {
    // Reallocate if we need more space
    if (chunk.length > this.bufferCapacity) {
      this.reallocate(chunk.length);
    }

    // Get view into WASM memory at our buffer location
    const buffer = new Uint8Array(
      this.memory.buffer,
      this.bufferPtr,
      chunk.length,
    );

    // Copy data into WASM memory
    buffer.set(chunk);

    // Transform in-place
    (this.wasm.exports.record_to_tsv as CallableFunction)(
      this.bufferPtr,
      chunk.length,
    );

    // Return a copy (buffer is a view, we need to copy before next iteration)
    return buffer.slice(0, chunk.length);
  }

  /**
   * Async generator that transforms a stream
   */
  async *transformStream(
    source: AsyncIterable<Uint8Array>,
  ): AsyncIterable<Uint8Array> {
    try {
      for await (const chunk of source) {
        yield this.transform(chunk);
      }
    } finally {
      this.close();
    }
  }

  private reallocate(newSize: number) {
    // Free old buffer if it exists
    if (this.bufferPtr !== 0) {
      (this.wasm.exports.deallocate as CallableFunction)(
        this.bufferPtr,
        this.bufferCapacity,
      );
    }

    // Allocate new buffer
    this.bufferPtr = (this.wasm.exports.allocate as CallableFunction)(
      newSize,
    ) as number;
    this.bufferCapacity = newSize;
  }

  close() {
    // Cleanup on disposal
    if (this.bufferPtr !== 0) {
      (this.wasm.exports.deallocate as CallableFunction)(
        this.bufferPtr,
        this.bufferCapacity,
      );
      this.bufferPtr = 0;
      this.bufferCapacity = 0;
    }
  }
}
