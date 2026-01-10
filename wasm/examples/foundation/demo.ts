import { OdinRuntime } from "./odin-runtime.ts";

/**
 * WebAssembly Math Demo class for Odin-compiled WASM module
 */
export class Demo {
  private wasmInstance: WebAssembly.Instance;
  public memory: WebAssembly.Memory;

  private constructor(
    wasmInstance: WebAssembly.Instance,
    memory: WebAssembly.Memory,
  ) {
    this.wasmInstance = wasmInstance;
    this.memory = memory;
  }

  static async create(): Promise<Demo> {
    console.log("🚀 TypeScript: Loading WASM module...");

    const scriptDir = new URL(".", import.meta.url).pathname;
    const wasmBytes = await Deno.readFile(scriptDir + "demo.wasm");
    const wasmModule = await WebAssembly.compile(wasmBytes);

    const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
    const runtime = new OdinRuntime(memory);

    const instance = await WebAssembly.instantiate(wasmModule, {
      env: { memory },
      odin_env: runtime.env,
    });

    console.log("✅ TypeScript: WASM module loaded successfully");
    return new Demo(instance, memory);
  }

  calculateCircle(radius: number): number {
    console.log(`🔵 TypeScript: Calling calculateCircle(${radius})`);
    const result =
      (this.wasmInstance.exports.calculate_circle as CallableFunction)(
        radius,
      ) as number;
    console.log(`🔵 TypeScript: Result = ${result.toFixed(2)}`);
    return result;
  }

  fibonacci(n: number): number {
    console.log(`🔢 TypeScript: Calling fibonacci(${n})`);
    const result = (this.wasmInstance.exports.fibonacci as CallableFunction)(
      n,
    ) as number;
    console.log(`🔢 TypeScript: Result = ${result}`);
    return result;
  }

  allocateMemory(
    size: number,
  ): { ptr: number; success: boolean; memorySize: number } {
    const exports = this.wasmInstance.exports;
    const ptr = (exports.allocate_memory as CallableFunction)(size) as number;
    const success = ptr !== 0;
    if (success) (exports.free_memory as CallableFunction)(ptr);
    return { ptr, success, memorySize: this.memory.buffer.byteLength };
  }

  greetUser(name: string): number {
    console.log(`👋 TypeScript: Calling greetUser("${name}")`);
    const nameBytes = new TextEncoder().encode(name);
    const expectedLength =
      (this.wasmInstance.exports.greet_user as CallableFunction)(
        1024,
        nameBytes.length,
      ) as number;
    console.log(`👋 TypeScript: Expected greeting length = ${expectedLength}`);
    return expectedLength;
  }

  printString(message: string): number {
    console.log(`📝 TypeScript: Sending "${message}" to Odin`);
    const exports = this.wasmInstance.exports;
    const bytes = new TextEncoder().encode(message);
    const ptr = (exports.alloc_string as CallableFunction)(
      bytes.length,
    ) as number;
    try {
      new Uint8Array(this.memory.buffer).set(bytes, ptr);
      return (exports.print_string as CallableFunction)(
        ptr,
        bytes.length,
      ) as number;
    } finally {
      (exports.free_string as CallableFunction)(ptr, bytes.length);
    }
  }

  createGreeting(name: string): string {
    console.log(`🎁 TypeScript: Creating greeting for "${name}"`);
    const exports = this.wasmInstance.exports;
    const nameBytes = new TextEncoder().encode(name);
    const namePtr = (exports.alloc_string as CallableFunction)(
      nameBytes.length,
    ) as number;
    try {
      new Uint8Array(this.memory.buffer).set(nameBytes, namePtr);
      const packed = (exports.create_greeting as CallableFunction)(
        namePtr,
        nameBytes.length,
      ) as bigint;
      const ptr = Number(packed & 0xFFFFFFFFn);
      const len = Number(packed >> 32n);
      try {
        const result = new TextDecoder().decode(
          new Uint8Array(this.memory.buffer, ptr, len),
        );
        console.log(`🎁 TypeScript: Got "${result}"`);
        return result;
      } finally {
        (exports.free_buffer as CallableFunction)(ptr);
      }
    } finally {
      (exports.free_string as CallableFunction)(namePtr, nameBytes.length);
    }
  }

  createPoint(x: number, y: number): { x: number; y: number } {
    console.log(`📍 TypeScript: Creating point (${x}, ${y})`);
    const exports = this.wasmInstance.exports;
    const ptr = (exports.create_point as CallableFunction)(x, y) as number;
    try {
      const view = new DataView(this.memory.buffer);
      const point = {
        x: view.getFloat64(ptr, true),
        y: view.getFloat64(ptr + 8, true),
      };
      console.log(`📍 TypeScript: Got point (${point.x}, ${point.y})`);
      return point;
    } finally {
      (exports.free_point as CallableFunction)(ptr);
    }
  }

  makePoint(x: number, y: number): { x: number; y: number } {
    console.log(`📍 TypeScript: Making point (${x}, ${y}) via by-value return`);
    const exports = this.wasmInstance.exports;
    const outPtr = (exports.alloc_string as CallableFunction)(16) as number;
    try {
      (exports.make_point as CallableFunction)(outPtr, x, y);
      const view = new DataView(this.memory.buffer);
      const point = {
        x: view.getFloat64(outPtr, true),
        y: view.getFloat64(outPtr + 8, true),
      };
      console.log(`📍 TypeScript: Got point (${point.x}, ${point.y})`);
      return point;
    } finally {
      (exports.free_string as CallableFunction)(outPtr, 16);
    }
  }
}
