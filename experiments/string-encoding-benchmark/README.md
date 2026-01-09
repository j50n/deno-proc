# String Encoding Benchmark Results

This benchmark isolates the TextDecoder performance for UTF-8 vs UTF-16 decoding.

## Key Findings

**UTF-8 is consistently 2-4x faster than UTF-16** for ASCII/Latin text:

- **Small strings (50 chars)**: UTF-8 is 2.3-2.6x faster
- **Medium strings (200 chars)**: UTF-8 is 2.8x faster  
- **Large strings (2000 chars)**: UTF-8 is 4.0x faster
- **Many strings (10k)**: UTF-8 is 2.6x faster

## Why UTF-8 Wins

1. **Smaller memory footprint** - UTF-8 uses ~50% less memory for ASCII text
2. **Better cache efficiency** - Less memory to transfer
3. **Optimized decoder** - V8's UTF-8 decoder is highly optimized
4. **No endianness issues** - UTF-8 is byte-order independent

## When UTF-16 Might Win

- **Heavy Unicode text** with many non-ASCII characters
- **Direct string manipulation** in JavaScript (strings are UTF-16 internally)
- **Very specific use cases** where the conversion overhead matters less

## Recommendation

**Use UTF-8 for WASM string passing** - it's faster, uses less memory, and is simpler to implement.

## Running the Benchmark

```bash
cd experiments/string-encoding-benchmark
./benchmark.ts
```
