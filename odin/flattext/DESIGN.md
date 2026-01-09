# FlatText CSV/TSV Converter Design

## Overview

A high-performance streaming CSV/TSV converter using Odin WASM for parsing and TypeScript for I/O orchestration. Designed to handle **tens of gigabytes** of data through chunked streaming processing.

## Architecture

```
Input Stream → Chunk Reader → WASM Parser → Output Stream
     ↓              ↓             ↓            ↓
  File/Stdin → enumerate() → Process Chunk → writeTo()
```

## Lessons Learned from First Implementation Attempt

### What We Tried (January 2026)
1. **Simplified approach**: Used Deno's standard CSV parser with streaming I/O
2. **Bypassed WASM**: Replaced WASM parsing with `parse()` from `@std/csv`
3. **Lost key features**: `replaceTabs`, `replaceNewlines`, and other WASM-specific functionality

### Why It Failed
- **Missed the core requirement**: The whole point was to use WASM for high-performance parsing
- **Lost advanced features**: WASM parser had custom configuration options not available in standard parsers
- **Defeated the purpose**: Memory efficiency came from WASM implementation, not just streaming I/O

### WASI Discovery (January 2026)
**Game-changing realization**: WASI could eliminate most of our streaming complexity!

#### **WASI Benefits for FlatText:**
- **Direct stdin/stdout access** - WASM handles entire I/O pipeline
- **No memory copying** - Eliminates JavaScript ↔ WASM data marshaling
- **Blocking execution model** - `wasi.start()` hands control to WASM until completion
- **Command-line arguments** - Pass parser config via `args` array
- **Simpler architecture** - WASM becomes a standalone CLI program

#### **WASI Architecture:**
```
Deno → wasi.start() → WASM main() → Direct stdin processing → Direct stdout output
  ↓         ↓              ↓                ↓                      ↓
Blocks   Hands over    Runs like       No JS copying        No JS copying
thread   control      native CLI         needed               needed
```

#### **Implementation Strategy with WASI:**
```typescript
// Deno side - minimal wrapper
const wasi = new WASI({
  args: ["flattext", "csv2tsv", "--delimiter", ";", "--replace-tabs", " "]
});
const instance = new WebAssembly.Instance(wasmModule, {
  wasi_snapshot_preview1: wasi.wasiImport,
});
wasi.start(instance); // Blocks until WASM completes
```

```odin
// Odin WASM side - full control
main :: proc() {
    args := os.args
    config := parse_cli_args(args)
    
    // Direct streaming processing
    buffer: [64 * 1024]u8  // 64KB chunks
    for {
        n := os.read(os.stdin, buffer[:])
        if n == 0 do break
        
        processed := process_csv_chunk(buffer[:n], config)
        os.write(os.stdout, processed)
    }
}
```

#### **Key Advantages:**
1. **Eliminates stateful parser complexity** - Can process in simple chunks
2. **Reduces memory management issues** - No constant allocation/deallocation for I/O
3. **Native performance** - No JavaScript overhead in processing loop
4. **Simpler deployment** - Single WASM binary + minimal Deno wrapper
5. **True streaming** - WASM handles backpressure and flow control naturally

#### **Next Experiments:**
- **WASI proof of concept** - Simple stdin→stdout WASM program
- **Odin WASI integration** - Test `core:os` APIs with WASI runtime
- **Chunk processing** - Implement CSV parsing with fixed-size buffers
- **CLI argument parsing** - Handle all FlatText configuration options
- **Performance comparison** - WASI vs current JavaScript-mediated approach

### Git Repository Management Notes
**Important**: The experiments folder contains large data files (100MB+) that should not be in commit history.

#### **Cleanup Strategy for Production:**
1. **Clean current branch** - Interactive rebase to squash/organize commits
2. **Create orphan branch** - `git checkout --orphan clean-implementation`
3. **Selective add** - Only include production code, skip experiments/
4. **Single clean commit** - Logical, reviewable change
5. **Delete working branch** - Remove messy history

This approach avoids the complexity and risks of `git filter-branch` while achieving a clean repository.

### Key Insights for Next Attempt
1. **WASM must do the parsing** - That's the whole point of the project
2. **Streaming needs stateful WASM parser** - Can't just replace with standard library
3. **Need chunk boundary handling** - WASM parser must handle partial records across chunks
4. **Memory management is critical** - WASM allocator needs careful management for streaming

## Correct Streaming Design Requirements

### Core Principle
**The WASM parser MUST be used for actual CSV parsing** - streaming is about I/O orchestration, not replacing the parser.

### Required WASM Interface Changes
```odin
// Stateful parser for streaming
Parser_State :: struct {
    partial_record: [dynamic]u8,    // Incomplete record from previous chunk
    in_quotes:      bool,           // Quote state preservation  
    field_count:    int,            // Current field position
    config:         Parser_Config,  // Parser configuration
    buffer:         [dynamic]u8,    // Working buffer
}

// Streaming functions needed
@(export) parser_create :: proc(config_ptr: rawptr) -> rawptr
@(export) parser_process_chunk :: proc(parser_ptr: rawptr, input_ptr: rawptr, input_len: i32, output_ptr: rawptr) -> Chunk_Result
@(export) parser_finalize :: proc(parser_ptr: rawptr, output_ptr: rawptr) -> i32
@(export) parser_destroy :: proc(parser_ptr: rawptr)
```

### Fundamental Challenges to Solve

#### 1. Chunk Boundary Handling
- **Problem**: CSV records can span multiple chunks
- **Solution**: WASM parser must maintain state between chunks
- **Implementation**: Buffer partial records in parser state

#### 2. Quote State Preservation
- **Problem**: Quoted fields can span chunk boundaries
- **Solution**: Track quote state in parser between chunks
- **Implementation**: Boolean flag in parser state

#### 3. Memory Management
- **Problem**: WASM allocator needs careful management for streaming
- **Solution**: Fixed-size buffers with overflow handling
- **Implementation**: Circular buffers or dynamic reallocation

#### 4. Error Recovery
- **Problem**: Malformed CSV spanning chunks
- **Solution**: Error context preservation across chunks
- **Implementation**: Error state tracking in parser

### Next Implementation Strategy

#### Phase 1: WASM Stateful Parser
1. **Implement Parser_State struct** in Odin
2. **Add streaming functions** to WASM exports
3. **Handle chunk boundaries** in WASM code
4. **Test with simple cases** before full streaming

#### Phase 2: TypeScript Streaming Wrapper
1. **Create StreamingParser class** that wraps WASM functions
2. **Implement enumerate/writeTo pattern** for I/O
3. **Handle WASM memory management** properly
4. **Add error handling** for streaming edge cases

#### Phase 3: Integration & Testing
1. **CLI integration** with streaming detection
2. **Comprehensive testing** of chunk boundaries
3. **Performance benchmarking** vs non-streaming
4. **Memory usage validation** for large files

### Critical Success Factors

1. **Keep WASM as the parser** - Don't replace with standard library
2. **Understand chunk boundaries** - This is the hardest part
3. **Test incrementally** - Start with simple cases
4. **Memory management** - WASM allocator is tricky
5. **State preservation** - Parser state must survive between chunks

### Learning Objectives for Next Attempt

1. **WASM memory management** - How to properly allocate/deallocate
2. **Stateful parsing** - Maintaining parser state across function calls
3. **Chunk boundary algorithms** - How to handle partial records
4. **Error propagation** - From WASM to TypeScript in streaming context
5. **Performance optimization** - Balancing chunk size vs overhead

## Current Status

- ✅ Basic streaming I/O pattern works with enumerate/writeTo
- ✅ CLI integration is straightforward
- ❌ WASM parser integration for streaming not implemented
- ❌ Stateful parser interface not created
- ❌ Chunk boundary handling not solved

The foundation is solid, but we need to tackle the core WASM streaming challenge properly next time.

## Streaming Design Requirements

### Streaming Components

1. **Input Streaming**
   - Use `enumerate(read(file))` or `enumerate(Deno.stdin.readable)`
   - Process data in configurable chunks (default: 64KB)
   - Handle partial records at chunk boundaries

2. **WASM Chunk Processing**
   - WASM parser maintains internal state between chunks
   - Handles incomplete records spanning chunk boundaries
   - Returns processed output + any remaining partial data

3. **Output Streaming**
   - Use `writeTo(Deno.stdout.writable)` or file output
   - Stream converted data as soon as available
   - No buffering of complete output

### Memory Management
- **Fixed memory footprint** regardless of input size
- **Chunk size limits** maximum memory usage
- **WASM state preservation** between chunks for partial records

## WASM Interface Design

### Stateful Parser Interface
```odin
// Parser state (maintained between chunks)
Parser_State :: struct {
    partial_record: [dynamic]u8,    // Incomplete record from previous chunk
    in_quotes:      bool,           // Quote state preservation
    field_count:    int,            // Current field position
    config:         Parser_Config,  // Parser configuration
}

// Streaming functions
@(export) parser_create :: proc(config_ptr: rawptr) -> rawptr
@(export) parser_process_chunk :: proc(
    parser_ptr: rawptr, 
    input_ptr: rawptr, 
    input_len: i32,
    output_ptr: rawptr,
    output_capacity: i32
) -> Chunk_Result

@(export) parser_finalize :: proc(parser_ptr: rawptr, output_ptr: rawptr) -> i32
@(export) parser_destroy :: proc(parser_ptr: rawptr)

// Result structure
Chunk_Result :: struct {
    output_len:     i32,    // Bytes written to output
    input_consumed: i32,    // Bytes consumed from input
    has_partial:    bool,   // Has incomplete record
    error_code:     i32,    // Error status
}
```

### State Management
- **Parser instance** created once, reused for entire file
- **Partial records** preserved between chunks
- **Quote state** maintained across chunk boundaries
- **Field validation** accumulated across chunks

## TypeScript Streaming Implementation

### CLI Streaming Architecture
```typescript
async function streamingConvert(
  input: ReadableStream<Uint8Array>,
  output: WritableStream<Uint8Array>,
  config: ParserConfig
): Promise<void> {
  const converter = await FlatText.create();
  const parser = converter.createStreamingParser(config);
  
  await enumerate(input)
    .map(chunk => parser.processChunk(chunk))
    .writeTo(output);
    
  // Finalize any remaining partial data
  const finalChunk = parser.finalize();
  if (finalChunk.length > 0) {
    await output.write(finalChunk);
  }
}
```

### API Streaming Methods
```typescript
class FlatText {
  // Existing non-streaming methods for small data
  csvToTsv(input: string, config?: ParserConfig): string
  tsvToCsv(input: string, config?: ParserConfig): string
  
  // New streaming methods for large data
  createStreamingParser(config?: ParserConfig): StreamingParser
  
  async streamCsvToTsv(
    input: ReadableStream<Uint8Array>, 
    output: WritableStream<Uint8Array>,
    config?: ParserConfig
  ): Promise<void>
}

class StreamingParser {
  processChunk(chunk: Uint8Array): Uint8Array
  finalize(): Uint8Array
  destroy(): void
}
```

## Data Flow Design

### Chunk Processing Flow
1. **Read chunk** from input stream (64KB default)
2. **Pass to WASM** with parser state
3. **WASM processes** complete records in chunk
4. **Returns output** + updates state with partial record
5. **Write output** to stream immediately
6. **Repeat** until input exhausted
7. **Finalize** any remaining partial data

### Boundary Handling
- **Incomplete records** at chunk end preserved in parser state
- **Quote state** maintained across boundaries
- **Field counting** continues across chunks
- **Error recovery** for malformed data spans

### Memory Efficiency
- **Constant memory usage** regardless of file size
- **No full-file buffering** at any stage
- **Immediate output** as data becomes available
- **Configurable chunk size** for memory/performance tuning

## CLI Implementation

### Streaming Commands
```bash
# Stream large files
flattext csv2tsv --chunk-size 128KB < huge-file.csv > output.tsv
flattext tsv2csv --chunk-size 64KB < massive-data.tsv > result.csv

# Pipe through other tools
cat data.csv | flattext csv2tsv | gzip > compressed.tsv.gz
```

### Configuration Options
- `--chunk-size <size>` - Processing chunk size (default: 64KB)
- `--buffer-size <size>` - I/O buffer size (default: 8KB)
- All existing parser options (delimiter, comment, etc.)

## Performance Characteristics

### Scalability
- **O(1) memory usage** - constant regardless of input size
- **Linear time complexity** - O(n) where n is input size
- **Streaming throughput** - limited by I/O, not memory
- **Handles 10+ GB files** with fixed memory footprint

### Benchmarking Targets
- **1 GB file**: < 30 seconds processing time
- **10 GB file**: < 5 minutes processing time
- **Memory usage**: < 100MB regardless of input size
- **Throughput**: > 50 MB/s on modern hardware

## Error Handling in Streaming

### Recoverable Errors
- **Malformed records** - skip and continue processing
- **Partial chunk data** - preserve state and continue
- **Quote mismatches** - attempt recovery at chunk boundaries

### Fatal Errors
- **Invalid UTF-8** - abort with clear error message
- **Memory allocation failure** - abort gracefully
- **I/O errors** - propagate to caller with context

### Error Reporting
- **Line numbers** maintained across chunks
- **Byte offsets** for error location
- **Context preservation** for debugging

## Implementation Priority

### Phase 1: Core Streaming (Required)
1. **WASM stateful parser** with chunk processing
2. **TypeScript streaming wrapper** using enumerate/writeTo
3. **CLI streaming implementation** for large files
4. **Basic error handling** and state management

### Phase 2: Optimization (Future)
1. **Performance tuning** and benchmarking
2. **Advanced error recovery** mechanisms
3. **Parallel processing** for multi-core systems
4. **Compression support** for input/output streams

## Testing Strategy

### Streaming Tests
- **Large file simulation** - synthetic multi-GB data
- **Chunk boundary testing** - records spanning boundaries
- **State preservation** - parser state across chunks
- **Memory leak detection** - long-running processes
- **Performance benchmarks** - throughput measurements

### Edge Cases
- **Single-byte chunks** - extreme boundary conditions
- **Massive records** - records larger than chunk size
- **Quote-heavy data** - complex escaping across boundaries
- **Mixed line endings** - CRLF/LF across chunks

This streaming design ensures FlatText can handle **enterprise-scale data processing** while maintaining the simplicity and reliability of the current implementation.
