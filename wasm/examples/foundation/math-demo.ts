/**
 * Odin runtime functions for WebAssembly integration
 */
class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  // Math functions - Called by Odin's core:math package

  /** Called by math.sin() in Odin code */
  sin(x: number): number {
    return Math.sin(x);
  }

  /** Called by math.cos() in Odin code */
  cos(x: number): number {
    return Math.cos(x);
  }

  /** Called by math.sqrt() in Odin code */
  sqrt(x: number): number {
    return Math.sqrt(x);
  }

  /** Called by math.pow() in Odin code */
  pow(x: number, y: number): number {
    return Math.pow(x, y);
  }

  /** Called by math.ln() in Odin code */
  ln(x: number): number {
    return Math.log(x);
  }

  /** Called by math.exp() in Odin code */
  exp(x: number): number {
    return Math.exp(x);
  }

  /** Called by math.ldexp() - scales x by 2^exp */
  ldexp(x: number, exp: number): number {
    return x * Math.pow(2, exp);
  }

  /** Called by math.fmuladd() - fused multiply-add: (a * b) + c */
  fmuladd(a: number, b: number, c: number): number {
    return a * b + c;
  }

  // Runtime functions - Called by Odin's runtime system

  /**
   * Called when Odin code uses fmt.print(), fmt.println(), or writes to stdout/stderr
   * @param fd - File descriptor: 1=stdout, 2=stderr
   * @param ptr - Memory pointer to string data
   * @param len - Length of string in bytes
   * @returns Number of bytes written
   */
  write(fd: number, ptr: number, len: number): number {
    const memView = new Uint8Array(this.memory.buffer);
    const bytes = memView.slice(ptr, ptr + len);
    const text = new TextDecoder().decode(bytes);
    if (fd === 1) console.log(text);
    else if (fd === 2) console.error(text);
    return len;
  }

  /**
   * Called when Odin encounters an unrecoverable error or explicit trap
   * Used by panic() and unreachable code paths
   */
  trap(): never {
    throw new Error("Odin trap");
  }

  /**
   * Called when Odin runtime needs to abort execution
   * Used by runtime errors and failed allocations
   */
  abort(): never {
    throw new Error("Odin abort");
  }

  /**
   * Called by Odin's alert() procedure for debugging output
   * @param ptr - Memory pointer to alert message
   * @param len - Length of message in bytes
   */
  alert(ptr: number, len: number): void {
    const memView = new Uint8Array(this.memory.buffer);
    const bytes = memView.slice(ptr, ptr + len);
    const text = new TextDecoder().decode(bytes);
    console.error("ALERT:", text);
  }

  /**
   * Called when an assert() fails in Odin code
   * @param file_ptr - Pointer to source filename
   * @param file_len - Length of filename
   * @param line - Line number where assertion failed
   * @param column - Column number where assertion failed
   * @param msg_ptr - Pointer to assertion message
   * @param msg_len - Length of assertion message
   */
  evaluate_assertion(
    file_ptr: number,
    file_len: number,
    line: number,
    column: number,
    msg_ptr: number,
    msg_len: number,
  ): never {
    const memView = new Uint8Array(this.memory.buffer);
    const file = new TextDecoder().decode(
      memView.slice(file_ptr, file_ptr + file_len),
    );
    const msg = new TextDecoder().decode(
      memView.slice(msg_ptr, msg_ptr + msg_len),
    );
    throw new Error(`Assertion failed at ${file}:${line}:${column} - ${msg}`);
  }

  /**
   * Creates environment object for WASM imports
   * @returns Plain object with bound methods for WASM consumption
   */
  createEnv(): Record<string, WebAssembly.ImportValue> {
    const env: Record<string, WebAssembly.ImportValue> = {};

    // Get all method names from the class prototype
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this));

    // Add prototype methods (class methods)
    for (const name of methodNames) {
      if (name !== "constructor" && name !== "createEnv") {
        env[name] =
          (this as unknown as Record<string, WebAssembly.ImportValue>)[name];
      }
    }

    // Add instance properties (arrow functions, if any)
    const instanceNames = Object.getOwnPropertyNames(this);
    for (const name of instanceNames) {
      if (name !== "memory") {
        env[name] =
          (this as unknown as Record<string, WebAssembly.ImportValue>)[name];
      }
    }

    return env;
  }
}

/**
 * WebAssembly Math Demo class for Odin-compiled WASM module
 */
export class MathDemo {
  private wasmInstance: WebAssembly.Instance;
  public memory: WebAssembly.Memory;

  private constructor(wasmInstance: WebAssembly.Instance) {
    this.wasmInstance = wasmInstance;
    this.memory = wasmInstance.exports.memory as WebAssembly.Memory;
  }

  /**
   * Creates and initializes a new MathDemo instance
   * @returns Promise resolving to MathDemo instance
   */
  static async create(): Promise<MathDemo> {
    console.log("🚀 TypeScript: Loading WASM module...");

    // Get path relative to this script's directory
    const scriptDir = new URL(".", import.meta.url).pathname;
    const wasmPath = scriptDir + "math-demo.wasm";

    const wasmBytes = await Deno.readFile(wasmPath);
    const wasmModule = await WebAssembly.compile(wasmBytes);

    // Create actual WebAssembly memory: 64KB initial, 16MB max
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 256 }); // 1 page = 64KB, 256 pages = 16MB

    const imports = {
      env: new OdinRuntime(memory).createEnv(),
    };

    const wasmInstance = await WebAssembly.instantiate(wasmModule, imports);

    console.log("✅ TypeScript: WASM module loaded successfully");
    return new MathDemo(wasmInstance);
  }

  /**
   * Calculates circle area using WASM
   * @param radius - Circle radius
   * @returns Circle area
   */
  calculateCircle(radius: number): number {
    console.log(`🔵 TypeScript: Calling calculateCircle(${radius})`);
    const calculate_circle = this.wasmInstance.exports
      .calculate_circle as CallableFunction;
    const result = calculate_circle(radius) as number;
    console.log(`🔵 TypeScript: Result = ${result.toFixed(2)}`);
    return result;
  }

  /**
   * Calculates fibonacci number using WASM
   * @param n - Fibonacci sequence position
   * @returns Fibonacci number at position n
   */
  fibonacci(n: number): number {
    console.log(`🔢 TypeScript: Calling fibonacci(${n})`);
    const fibonacci = this.wasmInstance.exports.fibonacci as CallableFunction;
    const result = fibonacci(n) as number;
    console.log(`🔢 TypeScript: Result = ${result}`);
    return result;
  }

  /**
   * Allocates and frees memory in WASM
   * @param size - Size in bytes to allocate
   * @returns Object with allocation results
   */
  allocateMemory(
    size: number,
  ): { ptr: number; success: boolean; memorySize: number } {
    const allocate_memory = this.wasmInstance.exports
      .allocate_memory as CallableFunction;
    const free_memory = this.wasmInstance.exports
      .free_memory as CallableFunction;

    const ptr = allocate_memory(size) as number;
    const success = ptr !== 0;

    if (success) {
      free_memory(ptr);
    }

    return { ptr, success, memorySize: this.memory.buffer.byteLength };
  }

  /**
   * Demonstrates string handling with WASM
   * @param name - Name to greet
   * @returns Expected length of greeting message
   */
  greetUser(name: string): number {
    console.log(`👋 TypeScript: Calling greetUser("${name}")`);
    const greet_user = this.wasmInstance.exports.greet_user as CallableFunction;

    // Convert string to bytes and write to memory (simplified demo)
    const nameBytes = new TextEncoder().encode(name);
    const expectedLength = greet_user(1024, nameBytes.length) as number;

    console.log(`👋 TypeScript: Expected greeting length = ${expectedLength}`);
    return expectedLength;
  }
}
