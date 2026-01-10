# js_wasm32 Memory Management Example

This example demonstrates how Odin's `js_wasm32` target enables dynamic memory management in WebAssembly using `make()` and `delete()`.

## Key Concepts Demonstrated

- **Dynamic Allocation**: WASM modules can use `make()` and `delete()` for memory management
- **Memory Growth**: WebAssembly memory can grow automatically as needed
- **Pointer Management**: JavaScript accessing WASM-allocated memory through pointers
- **Runtime Complexity**: The substantial runtime overhead of js_wasm32

## Files

- `simple_processor.odin` - Clean WASM module using `make()`/`delete()` internally
- `final_demo.ts` - JavaScript interface demonstrating memory management concepts
- `build.sh` - Build script for the WASM module

## Running the Example

```bash
# Build the WASM module
./build.sh

# Run the demonstration
deno run --allow-read final_demo.ts
```

## Expected Output

```
🚀 js_wasm32 Memory Management Demo

✅ js_wasm32 Processor initialized
📊 Initial memory: 1114112 bytes
📝 Adding lines (each allocation uses WASM's make()):
  ✓ "Hello, js_wasm32 world!"
    Lines: 1, WASM usage: 87 bytes
  ...

📋 Retrieving lines (accessing WASM-allocated strings):
  1: "[inaccessible: ptr=1114136, len=23]"
  ...

🎯 Key Insights:
  • WASM can use make/delete for dynamic allocation
  • Memory grows automatically when WASM needs more space
  • JavaScript can access WASM-allocated memory through pointers
  • Memory doesn't shrink after delete() - it's reused
  • This provides familiar programming model at cost of size/complexity
```

## The Educational Point

This example intentionally shows the **memory accessibility challenge** in js_wasm32:

1. **WASM successfully allocates** memory using `make()`
2. **Pointers are returned** to JavaScript
3. **JavaScript can't access them** because they're outside the current memory view

This demonstrates that while js_wasm32 provides familiar memory management, it requires careful coordination between WASM and JavaScript to handle memory growth properly.

## File Size Comparison

- **freestanding_wasm32**: 1,957 bytes
- **js_wasm32**: 27,184 bytes (13.9x larger!)

The size difference comes from the substantial runtime environment that js_wasm32 requires.

## When to Use js_wasm32

**Good for:**
- Complex data structures (maps, dynamic arrays, trees)
- Porting existing Odin code with heavy `make`/`delete` usage
- Development speed over file size
- Full Odin standard library access

**Not ideal for:**
- Simple data processing
- Size-constrained environments
- Predictable performance requirements
- Mobile or embedded applications

## Further Reading

See the comprehensive article in the mdbook: [js_wasm32 Memory Management](../docs/src/examples/js-wasm32-memory.md)
