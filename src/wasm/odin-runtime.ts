/**
 * Odin runtime environment for WebAssembly.
 *
 * Provides required imports for Odin-compiled WASM modules.
 * Most functions are stubs since they're not used in CSV processing.
 *
 * @module
 */

/**
 * Create Odin runtime environment for WASM.
 *
 * Odin-compiled WASM modules require these runtime imports for:
 * - Math functions (sin, cos, sqrt, etc.)
 * - System functions (time, random, etc.)
 *
 * Most are no-ops or stubs since we don't use them in CSV processing.
 *
 * @param memory - WebAssembly memory instance
 * @returns Import object for WASM instantiation
 */
export function createOdinRuntime(
  memory: WebAssembly.Memory,
): WebAssembly.Imports {
  return {
    env: { memory },
    odin_env: {
      // Math functions
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2,
      sqrt: Math.sqrt,
      pow: Math.pow,
      exp: Math.exp,
      ln: Math.log,
      log10: Math.log10,
      log2: Math.log2,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      trunc: Math.trunc,
      abs: Math.abs,
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      ldexp: (x: number, e: number) => x * Math.pow(2, e),
      fmuladd: (x: number, y: number, z: number) => x * y + z,

      // System stubs (unused in CSV processing)
      write: () => 0,
      trap: () => {},
      abort: () => {},
      alert: () => {},
      evaluate: () => {},
      time_now: () => 0n,
      tick_now: () => 0,
      time_sleep: () => {},
      rand_bytes: () => {},
    },
  };
}
