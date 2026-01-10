# WebAssembly + Deno + Odin Project

## Current State (2026-01-09)

Successfully built a complete WebAssembly project using Deno and Odin, completely removing WASI complexity.

## Project Structure

```
wasm/
├── examples/simple/             # Minimal working example
│   ├── uppercase.odin          # Odin WASM function (freestanding_wasm32)
│   ├── run.ts                  # Deno streaming runner
│   ├── build.sh               # Build script
│   └── test.sh                # Test script
├── docs/                       # Complete mdbook
│   ├── book.toml              # WebAssembly book config
│   └── src/
│       ├── SUMMARY.md         # Table of contents
│       ├── introduction.md     # WASM + Deno + Odin benefits
│       ├── wasm-basics.md     # WebAssembly fundamentals
│       ├── simple-example.md  # Working simple example
│       ├── memory-management.md # Memory patterns
│       └── performance.md      # Optimization techniques
└── deno.json                   # Clean config (no WASI deps)
```

## Key Technical Decisions

### WASM Instead of WASI
- **Abandoned WASI approach** - Too complex, limited streaming support
- **Pure WebAssembly** - Direct memory access, better performance
- **Deno handles I/O** - JavaScript manages streaming, WASM processes data

### Odin Compilation
- **Target**: `freestanding_wasm32` (not wasi_wasm32)
- **Export functions**: `@(export)` with `proc "c"` calling convention
- **Memory management**: Direct slice manipulation with `core:slice`

### Architecture Pattern
```
Deno (I/O) → WASM Memory → Odin Function → WASM Memory → Deno (Output)
```

## Working Example

### Odin Function (uppercase.odin)
```odin
package main
import "core:slice"

@(export)
uppercase :: proc "c" (input_ptr: rawptr, input_len: int, output_ptr: rawptr) -> int {
    input := slice.from_ptr(cast(^u8)input_ptr, input_len)
    output := slice.from_ptr(cast(^u8)output_ptr, input_len)
    
    for i in 0..<input_len {
        char := input[i]
        if char >= 'a' && char <= 'z' {
            output[i] = char - 32
        } else {
            output[i] = char
        }
    }
    return input_len
}
```

### Deno Runner (run.ts)
```typescript
const wasmBytes = await Deno.readFile("./uppercase.wasm");
const wasmModule = await WebAssembly.compile(wasmBytes);
const wasmInstance = await WebAssembly.instantiate(wasmModule);

const uppercase = wasmInstance.exports.uppercase as CallableFunction;
const memory = wasmInstance.exports.memory as WebAssembly.Memory;

for await (const chunk of Deno.stdin.readable) {
    const memView = new Uint8Array(memory.buffer);
    memView.set(chunk, 0);
    const outputLen = uppercase(0, chunk.length, chunk.length) as number;
    const result = memView.slice(chunk.length, chunk.length + outputLen);
    await Deno.stdout.write(result);
}
```

### Build Process
```bash
odin build uppercase.odin -file -target:freestanding_wasm32 -out:uppercase.wasm -debug
```

## Testing
```bash
echo "hello world" | deno run --allow-read run.ts
# Output: HELLO WORLD
```

## Next Steps for Expansion

The "simple" example is the foundation. Ready to layer on:
1. **Line-oriented processing** - Handle partial lines with overflow buffers
2. **Multiple functions** - Export several WASM functions
3. **Complex data types** - JSON, structured data processing
4. **Memory optimization** - Buffer reuse, growth handling
5. **Performance patterns** - Batching, parallel processing

## Key Insights Learned

- **WASI is overkill** for most use cases - pure WASM is simpler and faster
- **Deno + WASM pattern** works excellently - each does what it's best at
- **Odin compiles cleanly** to WASM with minimal setup
- **Memory management** is straightforward with direct buffer access
- **Streaming works perfectly** - no pre-loading limitations like @wasmer/wasi

## Documentation Status

- ✅ Complete mdbook with 5 chapters
- ✅ Working example tested and verified  
- ✅ Zero WASI references (pure WASM focus)
- ✅ Ready for expansion with more complex examples
