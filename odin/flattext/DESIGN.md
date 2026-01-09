# FlatText CSV/TSV Converter Design

## Overview

A high-performance CSV/TSV converter using Odin WASM for parsing and TypeScript for the API layer. Provides both a CLI tool and a reusable TypeScript API.

## Architecture

```
Input → TypeScript API → Odin WASM → Shared Memory → TypeScript API → Output
```

## Components

### 1. CLI Tool (`flattext.ts`)
- **Single executable** at project root
- **Subcommands**: `csv2tsv` and `tsv2csv`
- **Framework**: Cliffy for argument parsing
- **I/O**: Deno stdin/stdout streams
- **Thin wrapper** around the core API

### 2. Core API (`wasm/flattext-api.ts`)
- **Main interface**: `FlatText` class
- **Factory method**: `FlatText.create()` for async initialization
- **Methods**: `csvToTsv()` and `tsvToCsv()` with optional configuration
- **Memory management**: Handles WASM memory allocation/deallocation
- **Error handling**: Proper error codes and messages

### 3. WASM Module (`odin/flattext/main.odin`)
- **Language**: Odin compiled to WebAssembly
- **Target**: `js_wasm32` for JavaScript integration
- **Memory**: Exports own memory buffer for zero-copy data transfer
- **Functions**: `csv_to_tsv_with_config()` with full configuration support

## File Structure

```
/
├── flattext.ts                    # CLI tool (moved to root)
├── wasm/
│   ├── flattext-api.ts           # Core TypeScript API
│   └── flattext.wasm             # Compiled WASM module
├── odin/flattext/
│   ├── main.odin                 # Odin source code
│   ├── DESIGN.md                 # This document
│   └── README.md                 # Basic documentation
├── tests/flattext/               # Comprehensive test suite
│   ├── basic.test.ts            # Basic functionality
│   ├── config.test.ts           # Configuration options
│   ├── replacements.test.ts     # Character replacements
│   ├── validation.test.ts       # Field validation
│   ├── combined.test.ts         # Multiple config options
│   ├── edge-cases.test.ts       # Boundary conditions
│   └── README.md                # Test documentation
├── build-wasm.sh                # WASM build script
├── build.sh                     # Main build script (includes WASM)
└── deno.json                    # Package config with bin entry
```

## CLI Interface

### Commands
```bash
flattext csv2tsv [options] < input.csv > output.tsv
flattext tsv2csv [options] < input.tsv > output.csv
```

### Configuration Options
- `--delimiter <char>` - Field delimiter (default: ',' for CSV, '\t' for TSV)
- `--comment <char>` - Comment character for ignoring lines (default: none)
- `--fields-per-record <n>` - Expected field count (default: variable)
- `--trim-leading-space` - Remove leading whitespace from fields
- `--lazy-quotes` - Allow unescaped quotes in fields (not implemented)
- `--multiline-fields` - Support quoted multiline fields (not implemented)
- `--replace-tabs <char>` - Replace embedded tabs with character
- `--replace-newlines <char>` - Replace embedded newlines with character

## TypeScript API

### Basic Usage
```typescript
import { FlatText } from "./wasm/flattext-api.ts";

const converter = await FlatText.create();

// Basic conversion
const tsv = converter.csvToTsv("name,age\nJohn,30");
const csv = converter.tsvToCsv("name\tage\nJohn\t30");

// With configuration
const result = converter.csvToTsv(input, {
  delimiter: ";",
  comment: "#",
  trimLeadingSpace: true,
  replaceTabs: " ",
  replaceNewlines: " "
});
```

### ParserConfig Interface
```typescript
interface ParserConfig {
  delimiter?: string;           // Field delimiter (single character)
  comment?: string;             // Comment character (single character)
  fieldsPerRecord?: number;     // Expected field count
  trimLeadingSpace?: boolean;   // Remove leading whitespace
  lazyQuotes?: boolean;         // Allow unescaped quotes (not implemented)
  multilineFields?: boolean;    // Support multiline fields (not implemented)
  replaceTabs?: string;         // Replace embedded tabs (single character)
  replaceNewlines?: string;     // Replace embedded newlines (single character)
}
```

## WASM Memory Management Solution

### Critical Discovery
**Problem**: WASM and JavaScript initially used separate memory spaces, preventing data transfer.

**Solution**: Use WASM-exported memory approach where Odin automatically exports memory via `wasmModule.instance.exports.memory.buffer`.

### Working Implementation
```typescript
// WASM writes to fixed buffer in its memory space
const outputLen = wasmModule.exports.csv_to_tsv_with_config(inputPtr, inputLen, configPtr);

// JavaScript reads directly from WASM memory (zero-copy)
const outputPtr = wasmModule.exports.get_output_ptr();
const outputView = new Uint8Array(wasmMemory.buffer, outputPtr, outputLen);
const result = new TextDecoder().decode(outputView);
```

### Memory Layout
- **Input**: Allocated in WASM memory, populated by JavaScript
- **Config**: Serialized struct in WASM memory at specific offsets
- **Output**: Fixed 64KB buffer in WASM memory space
- **Cleanup**: Proper deallocation of temporary memory

## Odin Implementation Details

### Parser Configuration Struct
```odin
Parser_Config :: struct {
    delimiter:         rune,    // Field delimiter (32-bit)
    comment:           rune,    // Comment character (32-bit, 0 = none)
    fields_per_record: i32,     // Expected field count (-1 = variable)
    trim_leading_space: bool,   // Remove leading whitespace
    lazy_quotes:       bool,    // Allow unescaped quotes
    multiline_fields:  bool,    // Support multiline fields
    replace_tabs:      rune,    // Replace embedded tabs (32-bit, 0 = error)
    replace_newlines:  rune,    // Replace embedded newlines (32-bit, 0 = error)
}
```

### Exported Functions
```odin
@(export) init :: proc "contextless" ()
@(export) get_output_ptr :: proc "contextless" () -> rawptr
@(export) csv_to_tsv :: proc "contextless" (input_ptr: rawptr, input_len: i32) -> i32
@(export) csv_to_tsv_with_config :: proc "contextless" (input_ptr: rawptr, input_len: i32, config_ptr: rawptr) -> i32
```

### Implementation Approach
- **Hybrid parsing**: Preprocess input (delimiter/comment handling) + Odin's built-in CSV parser
- **Arena allocator**: Reset between operations to prevent memory corruption
- **Error codes**: -1 (parse error), -2 (field count mismatch), -3 (embedded tabs), -4 (embedded newlines)
- **UTF-8 handling**: Proper encoding for multi-byte characters in output

## Build Process

### WASM Build
```bash
./build-wasm.sh
# OR manually:
cd odin/flattext
odin build main.odin -file -target:js_wasm32 -out:../../wasm/flattext.wasm -o:speed
```

### Full Build
```bash
./build.sh  # Includes WASM build + linting + type checking + tests
```

## Testing Strategy

### Comprehensive Test Suite (50 tests)
- **Basic functionality**: CSV/TSV conversion, empty input, quoted fields
- **Configuration options**: All ParserConfig fields tested individually
- **Character replacements**: Tab and newline replacement with various characters
- **Field validation**: Correct/incorrect field counts, error handling
- **Combined configurations**: Multiple options working together
- **Edge cases**: Unicode, emoji, malformed CSV, very long fields

### Test Organization
- **6 test files** covering different aspects
- **Isolated test instances** for each file
- **Realistic test data** with real-world scenarios
- **Error handling validation** for all failure modes

## Performance Characteristics

- **Zero-copy data transfer** between WASM and JavaScript
- **Streaming-capable** architecture (though not currently implemented)
- **Fixed memory allocation** (64KB output buffer)
- **Optimized compilation** (`-o:speed` flag)
- **Minimal memory management** overhead

## Error Handling

### Error Codes
- `0`: Success
- `-1`: Parse error (malformed CSV/TSV)
- `-2`: Field count mismatch
- `-3`: Embedded tab character (when no replacement specified)
- `-4`: Embedded newline character (when no replacement specified)

### Error Messages
Descriptive error messages provided for all error conditions with guidance on how to fix issues (e.g., "use replaceTabs option").

## Installation & Distribution

```bash
# Install CLI tool
deno install jsr:@j50n/proc/flattext

# Use as library
import { FlatText } from "jsr:@j50n/proc/wasm/flattext-api";
```

## Key Design Decisions

1. **Single WASM module**: One optimized module handles both CSV→TSV and TSV→CSV
2. **Configuration-driven**: Rich ParserConfig interface for flexibility
3. **Memory export approach**: WASM exports memory rather than importing from JS
4. **Hybrid parsing**: Leverage Odin's CSV parser with custom preprocessing
5. **CLI at root**: Simplified project structure with CLI as main entry point
6. **Comprehensive testing**: 50 tests covering all functionality and edge cases
7. **Clean architecture**: Separate API layer from CLI wrapper

## Future Enhancements

- **Streaming support**: Process large files in chunks
- **Additional formats**: Support for other delimited formats
- **Performance optimization**: Benchmarking and optimization
- **Advanced CSV features**: Full implementation of lazy quotes and multiline fields
- **Memory pooling**: Reuse allocated memory for better performance
