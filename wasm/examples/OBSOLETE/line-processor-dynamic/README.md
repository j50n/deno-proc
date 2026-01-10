# Line Processor WASM Example

This example demonstrates processing streaming data by splitting it into lines using WebAssembly, solving the exact problem you described: processing chunks of data, splitting on `\n` (handling `\r`), outputting lines with 32-bit length prefixes, and managing leftover data between calls.

## Features

- **Streaming line processing**: Handles chunks of data that may contain partial lines
- **Memory management**: Uses fixed buffers (64KB input, 128KB output, 4KB leftover) to avoid dynamic allocation
- **Line format**: Each output line is prefixed with a 32-bit little-endian length header
- **Leftover handling**: Incomplete lines are preserved for the next chunk
- **Cross-platform**: Works with `\n` and `\r\n` line endings
- **High performance**: ~25 MB/s throughput, 346K+ lines/second
- **Flush support**: Empty input flushes remaining leftover data

## Architecture

### WASM Module (Odin)
- Fixed 64KB input buffer for incoming chunks
- Fixed 128KB output buffer for processed lines  
- 4KB leftover buffer for incomplete lines between calls
- Exports functions for buffer access and processing
- Zero dynamic memory allocation

### Deno Interface
- `LineProcessor` class wraps WASM functionality
- Handles memory management and data marshaling
- Provides clean API for chunk processing
- Supports both streaming and batch processing

## Usage

```bash
# Build the WASM module
./build.sh

# Run basic test
deno run --allow-read test.ts

# Run streaming test with performance metrics
deno run --allow-read streaming_test.ts

# Run file processing integration example
deno run --allow-read --allow-write integration_example.ts
```

## Output Format

Each processed line in the output buffer follows this format:
```
[4 bytes: line length (little-endian u32)][line data without \n or \r]
```

This format allows efficient parsing and handles variable-length lines without delimiters.

## Key Implementation Details

1. **Memory Layout**: Fixed buffers prevent allocation overhead
2. **Leftover Management**: Partial lines are preserved across chunk boundaries
3. **Line Ending Handling**: Strips both `\n` and `\r\n` automatically
4. **Flush Capability**: Empty input processes any remaining leftover data
5. **Error Handling**: Returns 0 on buffer overflow or invalid input

This implementation provides the exact functionality you requested: pass in data chunks, get back length-prefixed lines with leftover data management for streaming scenarios.
