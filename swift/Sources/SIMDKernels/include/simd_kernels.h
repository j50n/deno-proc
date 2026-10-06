// Byte classifiers for 64-byte blocks, written with clang's wasm_simd128.h.
//
// Swift has no way to turn a SIMD comparison into a bitmask (wasm's
// i8x16.bitmask), so the classifiers live here. They are static inline and
// LLVM inlines them into the Swift callers, which carry the same +simd128
// target feature (from -Xcc -msimd128), so the call costs nothing.
//
// Every function reads 64 bytes from `p`, unaligned. Callers keep at least
// 64 readable bytes past any block they classify and mask off the tail.

#ifndef SIMD_KERNELS_H
#define SIMD_KERNELS_H

#include <stdint.h>
#include <wasm_simd128.h>

/// Bit i is set when p[i] is a double quote, LF, CR, `a`, or `b`.
static inline uint64_t special_mask64(const uint8_t *p, uint8_t a, uint8_t b) {
    const v128_t quote = wasm_i8x16_splat('"');
    const v128_t lf = wasm_i8x16_splat('\n');
    const v128_t cr = wasm_i8x16_splat('\r');
    const v128_t va = wasm_i8x16_splat((int8_t)a);
    const v128_t vb = wasm_i8x16_splat((int8_t)b);
    uint64_t mask = 0;
    for (int k = 0; k < 4; k++) {
        v128_t v = wasm_v128_load(p + 16 * k);
        v128_t hit = wasm_v128_or(
            wasm_v128_or(wasm_i8x16_eq(v, quote), wasm_i8x16_eq(v, lf)),
            wasm_v128_or(wasm_i8x16_eq(v, cr),
                         wasm_v128_or(wasm_i8x16_eq(v, va), wasm_i8x16_eq(v, vb))));
        mask |= (uint64_t)wasm_i8x16_bitmask(hit) << (16 * k);
    }
    return mask;
}

/// Bit i is set when p[i] is a UTF-8 continuation byte (10xxxxxx).
static inline uint64_t continuation_mask64(const uint8_t *p) {
    const v128_t limit = wasm_i8x16_splat(-64);  // 0xC0 as a signed byte
    uint64_t mask = 0;
    for (int k = 0; k < 4; k++) {
        v128_t v = wasm_v128_load(p + 16 * k);
        mask |= (uint64_t)wasm_i8x16_bitmask(wasm_i8x16_lt(v, limit)) << (16 * k);
    }
    return mask;
}

/// Bit i is set when p[i] starts a four-byte UTF-8 sequence (11110xxx or above).
static inline uint64_t four_byte_lead_mask64(const uint8_t *p) {
    const v128_t lead = wasm_i8x16_splat((int8_t)0xF0);
    uint64_t mask = 0;
    for (int k = 0; k < 4; k++) {
        v128_t v = wasm_v128_load(p + 16 * k);
        mask |= (uint64_t)wasm_i8x16_bitmask(wasm_u8x16_ge(v, lead)) << (16 * k);
    }
    return mask;
}

#endif
