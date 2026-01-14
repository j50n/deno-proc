/**
 * Odin WebAssembly Runtime Environment
 *
 * Provides the `odin_env` imports required by Odin's js_wasm32 target.
 * Build with `--import-memory` to use this pattern.
 *
 * @example
 * ```typescript
 * const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
 * const runtime = new OdinRuntime(memory);
 * const instance = await WebAssembly.instantiate(module, {
 *   env: { memory },
 *   odin_env: runtime.env,
 * });
 * ```
 */
export class OdinRuntime {
  constructor(private memory: WebAssembly.Memory) {}

  /** Returns the import object for `odin_env` namespace. */
  get env(): Record<string, WebAssembly.ImportValue> {
    return {
      sin: this.sin.bind(this),
      cos: this.cos.bind(this),
      sqrt: this.sqrt.bind(this),
      pow: this.pow.bind(this),
      ln: this.ln.bind(this),
      exp: this.exp.bind(this),
      ldexp: this.ldexp.bind(this),
      fmuladd: this.fmuladd.bind(this),
      tan: this.tan.bind(this),
      asin: this.asin.bind(this),
      acos: this.acos.bind(this),
      atan: this.atan.bind(this),
      atan2: this.atan2.bind(this),
      log10: this.log10.bind(this),
      log2: this.log2.bind(this),
      floor: this.floor.bind(this),
      ceil: this.ceil.bind(this),
      round: this.round.bind(this),
      trunc: this.trunc.bind(this),
      abs: this.abs.bind(this),
      sinh: this.sinh.bind(this),
      cosh: this.cosh.bind(this),
      tanh: this.tanh.bind(this),
      write: this.write.bind(this),
      trap: this.trap.bind(this),
      abort: this.abort.bind(this),
      alert: this.alert.bind(this),
      evaluate: this.evaluate.bind(this),
      time_now: this.time_now.bind(this),
      tick_now: this.tick_now.bind(this),
      time_sleep: this.time_sleep.bind(this),
      rand_bytes: this.rand_bytes.bind(this),
    };
  }

  // ===========================================================================
  // MATH - Called by Odin's core:math package
  // ===========================================================================

  /** Called by `math.sin(x)` */
  sin(x: number): number {
    return Math.sin(x);
  }

  /** Called by `math.cos(x)` */
  cos(x: number): number {
    return Math.cos(x);
  }

  /** Called by `math.sqrt(x)` */
  sqrt(x: number): number {
    return Math.sqrt(x);
  }

  /** Called by `math.pow(x, y)` */
  pow(x: number, y: number): number {
    return Math.pow(x, y);
  }

  /** Called by `math.ln(x)` */
  ln(x: number): number {
    return Math.log(x);
  }

  /** Called by `math.exp(x)` */
  exp(x: number): number {
    return Math.exp(x);
  }

  /** Called by `math.ldexp(x, exp)` - returns x * 2^exp */
  ldexp(x: number, exp: number): number {
    return x * Math.pow(2, exp);
  }

  /** Called by `math.fmuladd(x, y, z)` - fused multiply-add: x*y + z */
  fmuladd(x: number, y: number, z: number): number {
    return x * y + z;
  }

  /** Called by `math.tan(x)` */
  tan(x: number): number {
    return Math.tan(x);
  }

  /** Called by `math.asin(x)` */
  asin(x: number): number {
    return Math.asin(x);
  }

  /** Called by `math.acos(x)` */
  acos(x: number): number {
    return Math.acos(x);
  }

  /** Called by `math.atan(x)` */
  atan(x: number): number {
    return Math.atan(x);
  }

  /** Called by `math.atan2(y, x)` */
  atan2(y: number, x: number): number {
    return Math.atan2(y, x);
  }

  /** Called by `math.log10(x)` */
  log10(x: number): number {
    return Math.log10(x);
  }

  /** Called by `math.log2(x)` */
  log2(x: number): number {
    return Math.log2(x);
  }

  /** Called by `math.floor(x)` */
  floor(x: number): number {
    return Math.floor(x);
  }

  /** Called by `math.ceil(x)` */
  ceil(x: number): number {
    return Math.ceil(x);
  }

  /** Called by `math.round(x)` */
  round(x: number): number {
    return Math.round(x);
  }

  /** Called by `math.trunc(x)` */
  trunc(x: number): number {
    return Math.trunc(x);
  }

  /** Called by `math.abs(x)` */
  abs(x: number): number {
    return Math.abs(x);
  }

  /** Called by `math.sinh(x)` */
  sinh(x: number): number {
    return Math.sinh(x);
  }

  /** Called by `math.cosh(x)` */
  cosh(x: number): number {
    return Math.cosh(x);
  }

  /** Called by `math.tanh(x)` */
  tanh(x: number): number {
    return Math.tanh(x);
  }

  // ===========================================================================
  // I/O - Called by Odin's fmt package
  // ===========================================================================

  /**
   * Called by `fmt.print()`, `fmt.println()`, `fmt.printf()`, etc.
   * @param fd - File descriptor: 1 = stdout, 2 = stderr
   * @param ptr - Pointer to string data in WASM memory
   * @param len - Byte length of string
   * @returns Number of bytes written
   */
  write(fd: number, ptr: number, len: number): number {
    const bytes = new Uint8Array(this.memory.buffer, ptr, len);
    const text = new TextDecoder().decode(bytes);
    if (fd === 1) console.log(text);
    else if (fd === 2) console.error(text);
    return len;
  }

  // ===========================================================================
  // ERROR HANDLING - Called by Odin's runtime on errors
  // ===========================================================================

  /** Called by `panic()`, `unreachable()`, bounds check failures, etc. */
  trap(): never {
    throw new Error("Odin trap");
  }

  /** Called on runtime errors like failed allocations. */
  abort(): never {
    throw new Error("Odin abort");
  }

  /**
   * Called by Odin's `alert()` builtin for debug output.
   * @param ptr - Pointer to message in WASM memory
   * @param len - Byte length of message
   */
  alert(ptr: number, len: number): void {
    const bytes = new Uint8Array(this.memory.buffer, ptr, len);
    console.warn("ODIN ALERT:", new TextDecoder().decode(bytes));
  }

  /**
   * Called by Odin runtime for dynamic JS evaluation. Intentionally disabled.
   * @throws Always throws - eval from WASM is a security risk
   */
  evaluate(ptr: number, len: number): void {
    const bytes = new Uint8Array(this.memory.buffer, ptr, len);
    throw new Error(`ODIN EVALUATE called: ${new TextDecoder().decode(bytes)}`);
  }

  // ===========================================================================
  // TIME - Called by Odin's time package
  // ===========================================================================

  /** Called by `time.now()` - returns nanoseconds since Unix epoch. */
  time_now(): bigint {
    return BigInt(Date.now()) * 1000000n;
  }

  /** Called by `time.tick_now()` - returns high-resolution timestamp in ms. */
  tick_now(): number {
    return performance.now();
  }

  /** Called by `time.sleep()` - no-op in WASM (can't block). */
  time_sleep(_ms: number): void {}

  // ===========================================================================
  // RANDOM - Called by Odin's random number generators
  // ===========================================================================

  /**
   * Called by `rand.bytes()` and other random functions.
   * Fills memory with cryptographically secure random bytes.
   * @param addr - Address in WASM memory to write to
   * @param len - Number of random bytes to generate
   */
  rand_bytes(addr: number, len: number): void {
    crypto.getRandomValues(new Uint8Array(this.memory.buffer, addr, len));
  }
}
