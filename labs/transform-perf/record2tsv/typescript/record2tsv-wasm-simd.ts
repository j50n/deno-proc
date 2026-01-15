/**
 * Record2TSV WASM SIMD Transformer
 *
 * Wraps the Odin WASM SIMD module for record→TSV transformation.
 * Uses 128-bit SIMD vectors to process 16 bytes at a time.
 * Over-allocates buffers to 16-byte alignment for SIMD efficiency.
 */

import { OdinRuntime } from "./odin-runtime.ts";

export class Record2TsvWasmSimd {
  private wasm: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private bufferPtr: number = 0;
  private bufferCapacity: number = 0;

  private constructor(wasm: WebAssembly.Instance, memory: WebAssembly.Memory) {
    this.wasm = wasm;
    this.memory = memory;
  }

  /**
   * Load and instantiate the WASM SIMD module
   */
  static async create(): Promise<Record2TsvWasmSimd> {
    const wasmPath =
      new URL("../odin/record2tsv-simd.wasm", import.meta.url).pathname;
    const wasmBytes = await Deno.readFile(wasmPath);
    const wasmModule = await WebAssembly.compile(wasmBytes);

    const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
    const runtime = new OdinRuntime(memory);

    const instance = await WebAssembly.instantiate(wasmModule, {
      env: { memory },
      odin_env: runtime.env,
    });

    return new Record2TsvWasmSimd(instance, memory);
  }

  /**
   * Transform a single chunk in-place using SIMD
   */
  transform(chunk: Uint8Array): Uint8Array {
    // Reallocate if we need more space (rounds up to 16-byte alignment)
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

    // Transform in-place with SIMD (processes aligned buffer, ignores padding)
    (this.wasm.exports.record_to_tsv_simd as CallableFunction)(
      this.bufferPtr,
      chunk.length,
    );

    // Return a copy (only the actual data, not padding)
    return buffer.slice(0, chunk.length);
  }

  private reallocate(newSize: number) {
    // Free old buffer if it exists
    if (this.bufferPtr !== 0) {
      (this.wasm.exports.deallocate_simd as CallableFunction)(
        this.bufferPtr,
        this.bufferCapacity,
      );
    }

    // Allocate new buffer (automatically rounds up to 16-byte alignment)
    this.bufferPtr = (this.wasm.exports.allocate_simd as CallableFunction)(
      newSize,
    ) as number;
    // Store the aligned capacity for proper deallocation
    this.bufferCapacity = Math.ceil(newSize / 16) * 16;
  }

  close() {
    // Cleanup on disposal
    if (this.bufferPtr !== 0) {
      (this.wasm.exports.deallocate_simd as CallableFunction)(
        this.bufferPtr,
        this.bufferCapacity,
      );
      this.bufferPtr = 0;
      this.bufferCapacity = 0;
    }
  }
}
