# Quick Reference

## Test the Simple Example
```bash
cd /home/dev/ws/deno-proc/wasm/examples/simple
echo "test input" | deno run --allow-read run.ts
```

## Build the Book
```bash
cd /home/dev/ws/deno-proc/wasm/docs
mdbook build
```

## Project Focus
- **Pure WebAssembly** (no WASI)
- **Deno for I/O** + **WASM for processing**
- **Odin language** compiling to `freestanding_wasm32`
- **Simple foundation** ready for complex examples

## Current Status
✅ Working simple example  
✅ Complete documentation  
✅ Zero WASI dependencies  
✅ Ready for expansion
