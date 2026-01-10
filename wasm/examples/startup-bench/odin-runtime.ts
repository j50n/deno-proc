/**
 * Minimal Odin WebAssembly Runtime Environment
 */
export class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  write(fd: number, ptr: number, len: number): number {
    const bytes = new Uint8Array(this.memory.buffer).slice(ptr, ptr + len);
    const text = new TextDecoder().decode(bytes);
    if (fd === 1) console.log(text);
    else if (fd === 2) console.error(text);
    return len;
  }

  trap(): never { throw new Error("trap"); }
  abort(): never { throw new Error("abort"); }

  time_now(): bigint { return BigInt(Date.now()) * 1000000n; }
  tick_now(): number { return performance.now(); }
  time_sleep(_ms: number): void {}

  rand_bytes(addr: number, len: number): void {
    crypto.getRandomValues(new Uint8Array(this.memory.buffer, addr, len));
  }

  createEnv(): Record<string, WebAssembly.ImportValue> {
    const env: Record<string, WebAssembly.ImportValue> = {};
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
      if (name !== "constructor" && name !== "createEnv") {
        const method = (this as unknown as Record<string, unknown>)[name];
        if (typeof method === "function") {
          env[name] = method.bind(this);
        }
      }
    }
    return env;
  }
}
