/**
 * Record2TSV WASM SIMD Unrolled Transformer
 *
 * 4x loop unrolled version processing 64 bytes per iteration.
 */

import { OdinRuntime } from "./odin-runtime.ts";

export class Record2TsvWasmSimdUnrolled {
  private wasm: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private bufferPtr: number = 0;
  private bufferCapacity: number = 0;

  private constructor(wasm: WebAssembly.Instance, memory: WebAssembly.Memory) {
    this.wasm = wasm;
    this.memory = memory;
  }

  static async create(): Promise<Record2TsvWasmSimdUnrolled> {
    const wasmPath =
      new URL("../odin/record2tsv-simd-unrolled.wasm", import.meta.url)
        .pathname;
    const wasmBytes = await Deno.readFile(wasmPath);
    const wasmModule = await WebAssembly.compile(wasmBytes);

    const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
    const runtime = new OdinRuntime(memory);

    const instance = await WebAssembly.instantiate(wasmModule, {
      env: { memory },
      odin_env: runtime.env,
    });

    return new Record2TsvWasmSimdUnrolled(instance, memory);
  }

  transform(chunk: Uint8Array): Uint8Array {
    if (chunk.length > this.bufferCapacity) {
      this.reallocate(chunk.length);
    }

    const buffer = new Uint8Array(
      this.memory.buffer,
      this.bufferPtr,
      chunk.length,
    );

    buffer.set(chunk);

    (this.wasm.exports.record_to_tsv_simd_unrolled as CallableFunction)(
      this.bufferPtr,
      chunk.length,
    );

    return buffer.slice(0, chunk.length);
  }

  private reallocate(newSize: number) {
    if (this.bufferPtr !== 0) {
      (this.wasm.exports.deallocate_simd_unrolled as CallableFunction)(
        this.bufferPtr,
        this.bufferCapacity,
      );
    }

    this.bufferPtr =
      (this.wasm.exports.allocate_simd_unrolled as CallableFunction)(
        newSize,
      ) as number;
    this.bufferCapacity = Math.ceil(newSize / 64) * 64;
  }

  close() {
    if (this.bufferPtr !== 0) {
      (this.wasm.exports.deallocate_simd_unrolled as CallableFunction)(
        this.bufferPtr,
        this.bufferCapacity,
      );
      this.bufferPtr = 0;
      this.bufferCapacity = 0;
    }
  }
}
