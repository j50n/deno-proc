# Odin WASM + Deno Experiment

Simple experiment demonstrating efficient data passing between Deno and Odin-compiled WASM.

## Files

- `counter.odin` - Odin source code that counts bytes
- `launcher.ts` - Deno script that loads and calls the WASM module
- `build.sh` - Build script to compile Odin to WASM and run

## Usage

```bash
./build.sh
```

## How it works

1. **Odin side**: Exports functions for memory allocation, deallocation, and byte counting
2. **Deno side**: Allocates WASM memory, copies Uint8Array data, calls WASM function, cleans up
3. **Efficiency**: Direct memory copying to WASM linear memory for large data processing

## Key Functions

- `allocate(size)` - Allocates memory in WASM
- `count_bytes(ptr, length)` - Counts bytes at memory location
- `deallocate(ptr, size)` - Frees allocated memory

This pattern can be extended for more complex data processing while maintaining efficiency for large Uint8Array operations.
