/**
 * Odin WebAssembly Runtime Environment
 *
 * This class provides the complete set of functions that Odin's WebAssembly backend
 * expects to be available in the 'env' import module. These functions are called
 * directly by Odin's compiled WASM code to implement functionality that WebAssembly
 * cannot provide natively.
 *
 * Based on the official Odin WASM implementation and compiler backend requirements.
 *
 * References:
 * - https://github.com/thetarnav/odin-wasm/blob/main/wasm/env.js
 * - https://gist.github.com/sortofsleepy/603e70468f0b33c56e220df698451ce6
 * - https://pkg.odin-lang.org/core/math/
 */
class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  // ============================================================================
  // MATH FUNCTIONS
  // Functions called by Odin's core:math package when compiled to WebAssembly
  // ============================================================================

  /**
   * Sine function - called by math.sin() in Odin code
   * @param x - Angle in radians
   * @returns Sine of x
   */
  sin(x: number): number {
    return Math.sin(x);
  }

  /**
   * Cosine function - called by math.cos() in Odin code
   * @param x - Angle in radians
   * @returns Cosine of x
   */
  cos(x: number): number {
    return Math.cos(x);
  }

  /**
   * Square root function - called by math.sqrt() in Odin code
   * @param x - Input value
   * @returns Square root of x
   */
  sqrt(x: number): number {
    return Math.sqrt(x);
  }

  /**
   * Power function - called by math.pow() in Odin code
   * @param x - Base value
   * @param y - Exponent
   * @returns x raised to the power of y
   */
  pow(x: number, y: number): number {
    return Math.pow(x, y);
  }

  /**
   * Natural logarithm - called by math.ln() in Odin code
   * @param x - Input value
   * @returns Natural logarithm of x
   */
  ln(x: number): number {
    return Math.log(x);
  }

  /**
   * Exponential function - called by math.exp() in Odin code
   * @param x - Input value
   * @returns e raised to the power of x
   */
  exp(x: number): number {
    return Math.exp(x);
  }

  /**
   * Load exponent function - called by math.ldexp() in Odin code
   * Multiplies x by 2 raised to the power of exp
   * @param x - Significand
   * @param exp - Exponent (integer)
   * @returns x * 2^exp
   */
  ldexp(x: number, exp: number): number {
    return x * Math.pow(2, exp);
  }

  /**
   * Fused multiply-add - called by math.fmuladd() in Odin code
   * Computes (x * y) + z with higher precision than separate operations
   * @param x - First multiplicand
   * @param y - Second multiplicand
   * @param z - Addend
   * @returns (x * y) + z
   */
  fmuladd(x: number, y: number, z: number): number {
    return x * y + z;
  }

  // ============================================================================
  // ADDITIONAL MATH FUNCTIONS
  // Extended math functions that may be imported by Odin depending on usage
  // ============================================================================

  /**
   * Tangent function - called by math.tan() in Odin code
   * @param x - Angle in radians
   * @returns Tangent of x
   */
  tan(x: number): number {
    return Math.tan(x);
  }

  /**
   * Arc sine function - called by math.asin() in Odin code
   * @param x - Input value (must be in range [-1, 1])
   * @returns Arc sine of x in radians
   */
  asin(x: number): number {
    return Math.asin(x);
  }

  /**
   * Arc cosine function - called by math.acos() in Odin code
   * @param x - Input value (must be in range [-1, 1])
   * @returns Arc cosine of x in radians
   */
  acos(x: number): number {
    return Math.acos(x);
  }

  /**
   * Arc tangent function - called by math.atan() in Odin code
   * @param x - Input value
   * @returns Arc tangent of x in radians
   */
  atan(x: number): number {
    return Math.atan(x);
  }

  /**
   * Two-argument arc tangent - called by math.atan2() in Odin code
   * @param y - Y coordinate
   * @param x - X coordinate
   * @returns Arc tangent of y/x in radians, handling quadrants correctly
   */
  atan2(y: number, x: number): number {
    return Math.atan2(y, x);
  }

  /**
   * Base-10 logarithm - called by math.log10() in Odin code
   * @param x - Input value
   * @returns Base-10 logarithm of x
   */
  log10(x: number): number {
    return Math.log10(x);
  }

  /**
   * Base-2 logarithm - called by math.log2() in Odin code
   * @param x - Input value
   * @returns Base-2 logarithm of x
   */
  log2(x: number): number {
    return Math.log2(x);
  }

  /**
   * Floor function - called by math.floor() in Odin code
   * @param x - Input value
   * @returns Largest integer less than or equal to x
   */
  floor(x: number): number {
    return Math.floor(x);
  }

  /**
   * Ceiling function - called by math.ceil() in Odin code
   * @param x - Input value
   * @returns Smallest integer greater than or equal to x
   */
  ceil(x: number): number {
    return Math.ceil(x);
  }

  /**
   * Round function - called by math.round() in Odin code
   * @param x - Input value
   * @returns x rounded to the nearest integer
   */
  round(x: number): number {
    return Math.round(x);
  }

  /**
   * Truncate function - called by math.trunc() in Odin code
   * @param x - Input value
   * @returns Integer part of x (removes fractional part)
   */
  trunc(x: number): number {
    return Math.trunc(x);
  }

  /**
   * Absolute value function - called by math.abs() in Odin code
   * @param x - Input value
   * @returns Absolute value of x
   */
  abs(x: number): number {
    return Math.abs(x);
  }

  /**
   * Hyperbolic sine - called by math.sinh() in Odin code
   * @param x - Input value
   * @returns Hyperbolic sine of x
   */
  sinh(x: number): number {
    return Math.sinh(x);
  }

  /**
   * Hyperbolic cosine - called by math.cosh() in Odin code
   * @param x - Input value
   * @returns Hyperbolic cosine of x
   */
  cosh(x: number): number {
    return Math.cosh(x);
  }

  /**
   * Hyperbolic tangent - called by math.tanh() in Odin code
   * @param x - Input value
   * @returns Hyperbolic tangent of x
   */
  tanh(x: number): number {
    return Math.tanh(x);
  }

  // ============================================================================
  // RUNTIME FUNCTIONS
  // Core runtime functions called by Odin's runtime system and standard library
  // ============================================================================

  /**
   * Write function - called by fmt.print(), fmt.println(), and I/O operations
   * Handles output to stdout (fd=1) and stderr (fd=2)
   * @param fd - File descriptor: 1=stdout, 2=stderr
   * @param ptr - Memory pointer to string data
   * @param len - Length of string in bytes
   * @returns Number of bytes written (always equals len)
   */
  write(fd: number, ptr: number, len: number): number {
    const memView = new Uint8Array(this.memory.buffer);
    const bytes = memView.slice(ptr, ptr + len);
    const text = new TextDecoder().decode(bytes);

    if (fd === 1) {
      console.log(text);
    } else if (fd === 2) {
      console.error(text);
    } else {
      throw new Error(`Invalid file descriptor: ${fd}`);
    }

    return len;
  }

  /**
   * Trap function - called when Odin encounters an unrecoverable error
   * Used by panic() statements and unreachable code paths
   * @throws Always throws an error to halt execution
   */
  trap(): never {
    throw new Error("Odin trap: unrecoverable error");
  }

  /**
   * Abort function - called when Odin runtime needs to abort execution
   * Used by runtime errors, failed allocations, and critical failures
   * @throws Always throws an error to halt execution
   */
  abort(): never {
    throw new Error("Odin abort: runtime error");
  }

  /**
   * Alert function - called by Odin's alert() procedure for debugging
   * Displays debug messages to the console
   * @param ptr - Memory pointer to alert message
   * @param len - Length of message in bytes
   */
  alert(ptr: number, len: number): void {
    const memView = new Uint8Array(this.memory.buffer);
    const bytes = memView.slice(ptr, ptr + len);
    const text = new TextDecoder().decode(bytes);
    console.warn("ODIN ALERT:", text);
  }

  /**
   * Evaluate function - called for dynamic code evaluation (rarely used)
   * Executes JavaScript code from Odin strings
   * @param ptr - Memory pointer to JavaScript code string
   * @param len - Length of code string in bytes
   */
  evaluate(ptr: number, len: number): void {
    const memView = new Uint8Array(this.memory.buffer);
    const bytes = memView.slice(ptr, ptr + len);
    const code = new TextDecoder().decode(bytes);
    // Note: eval is used here as it's part of Odin's WASM interface
    // In production, consider security implications
    eval(code);
  }

  // ============================================================================
  // TIME FUNCTIONS
  // Time-related functions for Odin's time package
  // ============================================================================

  /**
   * Current time in nanoseconds - called by time.now() in Odin code
   * @returns Current timestamp in nanoseconds since Unix epoch
   */
  time_now(): bigint {
    return BigInt(Date.now()) * 1000000n; // Convert ms to ns
  }

  /**
   * High-resolution timer - called by time.tick_now() in Odin code
   * @returns High-resolution timestamp in milliseconds
   */
  tick_now(): number {
    return performance.now();
  }

  /**
   * Sleep function - called by time.sleep() in Odin code
   * Note: WebAssembly cannot actually sleep, this is a no-op
   * @param duration_ms - Duration to sleep in milliseconds
   */
  time_sleep(duration_ms: number): void {
    // WebAssembly cannot actually sleep synchronously
    // This is a no-op as per the Odin WASM specification
    if (duration_ms > 0) {
      console.warn(`Odin time.sleep(${duration_ms}ms) called - no-op in WASM`);
    }
  }

  // ============================================================================
  // RANDOM FUNCTIONS
  // Cryptographically secure random number generation
  // ============================================================================

  /**
   * Random bytes generation - called by Odin's random number generators
   * Fills memory region with cryptographically secure random bytes
   * @param addr - Memory address to write random bytes
   * @param len - Number of random bytes to generate
   */
  rand_bytes(addr: number, len: number): void {
    const view = new Uint8Array(this.memory.buffer, addr, len);
    crypto.getRandomValues(view);
  }

  /**
   * Creates environment object for WASM imports
   * @returns Plain object with bound methods for WASM consumption
   */
  createEnv(): Record<string, WebAssembly.ImportValue> {
    const env: Record<string, WebAssembly.ImportValue> = {};

    // Get all method names from the class prototype
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this));

    // Add prototype methods (class methods) - bind them to preserve 'this'
    for (const name of methodNames) {
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
      odin_env: new OdinRuntime(memory).createEnv(),
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

  /**
   * Prints a string using Odin's fmt.println
   * Demonstrates the safe pattern: allocate → write → call → free
   * @param message - String to print
   * @returns Byte length of the printed string
   */
  printString(message: string): number {
    console.log(`📝 TypeScript: Sending "${message}" to Odin`);

    const alloc_string = this.wasmInstance.exports
      .alloc_string as CallableFunction;
    const free_string = this.wasmInstance.exports
      .free_string as CallableFunction;
    const print_string = this.wasmInstance.exports
      .print_string as CallableFunction;

    const bytes = new TextEncoder().encode(message);
    let ptr: number | null = null;

    try {
      ptr = alloc_string(bytes.length) as number;
      new Uint8Array(this.memory.buffer).set(bytes, ptr);
      return print_string(ptr, bytes.length) as number;
    } finally {
      if (ptr !== null) {
        free_string(ptr, bytes.length);
      }
    }
  }

  /**
   * Creates a greeting using Odin's dynamic allocation
   * Demonstrates returning dynamic data: Odin allocates, JS reads and frees
   * @param name - Name to greet
   * @returns The greeting string
   */
  createGreeting(name: string): string {
    console.log(`🎁 TypeScript: Creating greeting for "${name}"`);

    const alloc_string = this.wasmInstance.exports
      .alloc_string as CallableFunction;
    const free_string = this.wasmInstance.exports
      .free_string as CallableFunction;
    const free_buffer = this.wasmInstance.exports
      .free_buffer as CallableFunction;
    const create_greeting = this.wasmInstance.exports
      .create_greeting as CallableFunction;

    const nameBytes = new TextEncoder().encode(name);
    const namePtr = alloc_string(nameBytes.length) as number;

    try {
      new Uint8Array(this.memory.buffer).set(nameBytes, namePtr);

      // Odin returns packed i64: high 32 bits = length, low 32 bits = pointer
      const packed = create_greeting(namePtr, nameBytes.length) as bigint;
      const ptr = Number(packed & 0xFFFFFFFFn);
      const len = Number(packed >> 32n);

      try {
        const result = new TextDecoder().decode(
          new Uint8Array(this.memory.buffer, ptr, len),
        );
        console.log(`🎁 TypeScript: Got "${result}"`);
        return result;
      } finally {
        free_buffer(ptr);
      }
    } finally {
      free_string(namePtr, nameBytes.length);
    }
  }

  /**
   * Creates a Point struct in Odin and reads it back
   * Demonstrates returning structs from WASM
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Point object with x and y
   */
  createPoint(x: number, y: number): { x: number; y: number } {
    console.log(`📍 TypeScript: Creating point (${x}, ${y})`);

    const create_point = this.wasmInstance.exports
      .create_point as CallableFunction;
    const free_point = this.wasmInstance.exports.free_point as CallableFunction;

    const ptr = create_point(x, y) as number;

    try {
      // Point struct: two f64 values (8 bytes each)
      const view = new DataView(this.memory.buffer);
      const point = {
        x: view.getFloat64(ptr, true), // little-endian
        y: view.getFloat64(ptr + 8, true),
      };
      console.log(`📍 TypeScript: Got point (${point.x}, ${point.y})`);
      return point;
    } finally {
      free_point(ptr);
    }
  }
}
