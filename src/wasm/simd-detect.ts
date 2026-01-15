/**
 * WebAssembly feature detection utilities.
 */

let simdSupported: boolean | undefined;

/**
 * Detect if WebAssembly SIMD is supported by the runtime.
 *
 * Uses `WebAssembly.validate()` to check if a minimal SIMD module can be loaded.
 * Result is cached after first call.
 *
 * **Browser/Runtime Support:**
 * - Chrome ≥ 91 (May 2021)
 * - Firefox ≥ 89 (June 2021)
 * - Safari ≥ 16.4 (March 2023)
 * - Node.js ≥ 16.4 (June 2021)
 * - Deno ≥ 1.9 (April 2021)
 *
 * @returns `true` if SIMD is supported, `false` otherwise
 *
 * @example
 * ```typescript
 * import { detectSimd } from "jsr:@j50n/proc/transforms";
 *
 * if (detectSimd()) {
 *   console.log("SIMD supported - using optimized transforms");
 * } else {
 *   console.log("SIMD not supported - using scalar fallback");
 * }
 * ```
 */
export function detectSimd(): boolean {
  if (simdSupported !== undefined) {
    return simdSupported;
  }

  try {
    // Minimal WASM module with a single SIMD instruction (v128.const)
    // This validates that the runtime can parse and accept SIMD opcodes
    simdSupported = WebAssembly.validate(
      new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // magic: \0asm
        0x01, 0x00, 0x00, 0x00, // version: 1
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type section: () -> v128
        0x03, 0x02, 0x01, 0x00, // func section
        0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, // code section with v128.const
        0xfd, 0x0c, 0xfd, 0x62, 0x0b,
      ]),
    );
  } catch {
    simdSupported = false;
  }

  return simdSupported;
}
