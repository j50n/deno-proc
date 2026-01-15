/**
 * Minimal Odin WebAssembly Runtime Environment
 *
 * Provides only the essential `odin_env` imports required by our simple
 * byte manipulation WASM module.
 */
export class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  /** Returns the import object for `odin_env` namespace. */
  get env(): Record<string, WebAssembly.ImportValue> {
    return {
      trap: this.trap.bind(this),
      abort: this.abort.bind(this),
      rand_bytes: this.rand_bytes.bind(this),
      write: this.write.bind(this),
    };
  }

  /** Called when Odin code hits a runtime trap/panic. */
  private trap(): void {
    throw new Error("WASM trap: Odin runtime error");
  }

  /** Called when Odin code explicitly aborts. */
  private abort(): void {
    throw new Error("WASM abort: Odin code called abort");
  }

  /** Called when Odin needs random bytes (for allocator). */
  private rand_bytes(ptr: number, len: number): void {
    const buffer = new Uint8Array(this.memory.buffer, ptr, len);
    crypto.getRandomValues(buffer);
  }

  /** Called when Odin writes to stdout/stderr. */
  private write(fd: number, ptr: number, len: number): number {
    const buffer = new Uint8Array(this.memory.buffer, ptr, len);
    const text = new TextDecoder().decode(buffer);
    if (fd === 1) {
      console.log(text);
    } else if (fd === 2) {
      console.error(text);
    }
    return len;
  }
}
