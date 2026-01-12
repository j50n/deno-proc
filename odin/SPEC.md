# CSV Streaming WASM Module Specification

## Quick Reference (Resume Here)

**Project**: High-performance CSV transforms using Odin WASM for proc library

**Key Files**:
- `odin/SPEC.md` - This specification
- `odin/` - Production Odin source (to be created)
- `wasm/` - Built WASM artifacts (to be created)
- `src/transforms/csv-fast.ts` - TypeScript wrapper (to be created)
- `labs/wasm/` - Reference examples and documentation
- `labs/wasm/AI_GUIDE.md` - Essential WASM patterns for AI assistants

**API Functions**:
- `fromCsvToRowsFast()` → `AsyncIterable<string[][]>`
- `fromCsvToLazyRowsFast()` → `AsyncIterable<LazyRow[]>`
- `toCsvFast()` → `AsyncIterable<Uint8Array>`

**Key Design Decisions**:
1. Uses Odin `core:encoding/csv` with `reuse_record = true` and `reuse_record_buffer = true`
2. ASCII separators (\x1E record, \x1F field) for fast JS serialization
3. Grow-only buffers, disposed per transform
4. Stateful parser/generator instances

**Next Steps**: See Implementation Plan (Phase 1: Basic Parsing)

---

## AI Assistant Notes

**Before implementing, review these files:**
- `labs/wasm/AI_GUIDE.md` - Complete WASM/Odin/Deno patterns (~200 lines)
- `labs/wasm/examples/foundation/` - Working reference implementation
- `src/transforms/csv.ts` - Existing CSV transforms to match behavior
- `src/transforms/lazy-row.ts` - LazyRow binary format details

**Odin WASM gotchas:**
- Always set `context = runtime.default_context()` in exported procs
- Use `proc "c"` calling convention for exports
- Build with `js_wasm32` target and `--import-memory`
- Memory.buffer invalidates after WASM calls that allocate
- **AVOID returning structs from hot-path functions** - use out parameters instead. Struct returns cause expensive copies in WASM. Example: `parse_field(...) -> FieldResult` was 25% slower than `parse_field_out(..., out_end: ^int, out_start: ^int, ...) -> bool`

**⚠️ CRITICAL: Chunk Boundary Handling:**

CSV data arrives in arbitrary chunks with NO guaranteed boundaries. A chunk can split:
- In the middle of a UTF-8 code point (multibyte characters like emoji, CJK, etc.)
- In the middle of a field: `"hel` | `lo"`
- In the middle of a quoted field: `"hello` | ` world"`
- In the middle of an escape sequence: `"say ""` | `hello"""`
- In the middle of a newline (CRLF): `field\r` | `\nfield`
- Across multiple lines in a multiline quoted field

**The WASM module MUST:**
1. Buffer incomplete data internally between `process_csv_chunk` calls
2. Only output complete, fully-parsed rows
3. Handle incomplete UTF-8 sequences at chunk boundaries
4. Return unconsumed bytes count so TypeScript knows what was processed
5. Handle `flush_csv_parser` to process final partial data at stream end

**Required test cases:**
- UTF-8 multibyte character split (e.g., emoji 🎉 = 4 bytes, split at byte 2)
- Field split mid-word
- Quoted field split mid-content
- Escaped quote split (`""` across boundary)
- CRLF split across chunks
- Multiline quoted field spanning 3+ chunks
- Empty final chunk after complete data
- Single-byte chunks (stress test)
- Mixed ASCII and multibyte UTF-8 content

This is NOT optional - real-world CSV streams will hit all these cases.

**Performance testing:**
- Compare against existing `fromCsvToRows()` with large files
- Test with `dev/warandpeace.txt.gz` or similar large dataset
- Measure both throughput and memory usage

---

## Overview

High-performance CSV processing module built with Odin, compiled to WebAssembly, for use with Deno's proc library streaming pipeline. Provides drop-in replacement for existing CSV transforms with identical API but WASM-powered performance.

## Goals

- **API Compatibility**: Identical interface to existing `src/transforms/csv.ts` functions
- **Performance**: Leverage WASM for CPU-intensive parsing and transformation
- **Streaming**: Handle large CSV files without loading entire file into memory
- **Coexistence**: Work alongside existing Deno std/csv implementation without conflicts

## API Design

### Function Names (Fast Implementation)

- `fromCsvToRowsFast()` - Fast version of `fromCsvToRows()`
- `fromCsvToLazyRowsFast()` - Fast version of `fromCsvToLazyRows()`
- `toCsvFast()` - Fast version of `toCsv()`

### Type Compatibility

```typescript
// Identical interfaces to existing CSV transforms
export interface CsvParseOptionsFast extends CsvParseOptions {
  // May add performance-specific options later
}

export interface CsvStringifyOptionsFast extends CsvStringifyOptions {
  // May add performance-specific options later
}
```

### Core Transform Functions

```typescript
/**
 * High-performance CSV parsing to string arrays.
 * Drop-in replacement for fromCsvToRows() with identical behavior.
 */
export function fromCsvToRowsFast(parseOptions?: CsvParseOptionsFast) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<string[][]> {
    // Fast implementation
  };
}

/**
 * High-performance CSV parsing to LazyRow objects.
 * Drop-in replacement for fromCsvToLazyRows() with identical behavior.
 */
export function fromCsvToLazyRowsFast(parseOptions?: CsvParseOptionsFast) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> {
    // Fast implementation
  };
}

/**
 * High-performance CSV generation.
 * Drop-in replacement for toCsv() with identical behavior.
 */
export function toCsvFast(stringifyOptions?: CsvStringifyOptionsFast) {
  return async function* (data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>): AsyncIterable<Uint8Array> {
    // Fast implementation
  };
}
```

## WASM Module Interface (Odin Implementation)

### Memory Management

```odin
@(export)
alloc_input_buffer :: proc "c" (size: int) -> rawptr {
  context = runtime.default_context()
  return raw_data(make([]u8, size))
}

@(export)
alloc_output_buffer :: proc "c" (size: int) -> rawptr {
  context = runtime.default_context()
  return raw_data(make([]u8, size))
}

@(export)
free_buffer :: proc "c" (ptr: rawptr) {
  context = runtime.default_context()
  free(ptr)
}
```

### Parser State Management

```odin
import "core:encoding/csv"

// Global parser storage (simple approach)
parsers: map[i32]^csv.Reader
generators: map[i32]^csv.Writer
next_id: i32 = 1

@(export)
create_csv_parser :: proc "c" (options_ptr: rawptr) -> i32 {
  context = runtime.default_context()
  
  parser := new(csv.Reader)
  parser.reuse_record = true
  parser.reuse_record_buffer = true
  
  // Unpack options from options_ptr
  if options_ptr != nil {
    opts := cast(^ParseOptions)options_ptr
    parser.comma = rune(opts.separator)
    parser.comment = rune(opts.comment) if opts.comment != 0 else 0
    parser.trim_leading_space = bool(opts.trim_leading_space)
    parser.lazy_quotes = bool(opts.lazy_quotes)
    parser.multiline_fields = bool(opts.multiline_fields)
    parser.fields_per_record = opts.fields_per_record
  } else {
    parser.comma = ','
  }
  
  id := next_id
  next_id += 1
  parsers[id] = parser
  return id
}

@(export)
create_csv_generator :: proc "c" (options_ptr: rawptr) -> i32 {
  context = runtime.default_context()
  
  generator := new(csv.Writer)
  
  // Unpack options from options_ptr
  if options_ptr != nil {
    opts := cast(^StringifyOptions)options_ptr
    generator.comma = rune(opts.separator)
    generator.use_crlf = bool(opts.use_crlf)
  } else {
    generator.comma = ','
  }
  
  id := next_id
  next_id += 1
  generators[id] = generator
  return id
}

@(export)
destroy_csv_parser :: proc "c" (parser_id: i32) {
  context = runtime.default_context()
  if parser, ok := parsers[parser_id]; ok {
    csv.reader_destroy(parser)
    free(parser)
    delete_key(&parsers, parser_id)
  }
}

@(export)
destroy_csv_generator :: proc "c" (generator_id: i32) {
  context = runtime.default_context()
  if generator, ok := generators[generator_id]; ok {
    free(generator)
    delete_key(&generators, generator_id)
  }
}
```

### Core Processing Functions

```odin
@(export)
process_csv_chunk :: proc "c" (
  parser_id: i32,
  input_ptr: rawptr,
  input_len: int,
  output_ptr: rawptr,
  output_capacity: int
) -> i64 {
  context = runtime.default_context()
  
  parser, ok := parsers[parser_id]
  if !ok do return 0
  
  // Convert input to string and initialize parser
  input_data := slice.from_ptr(cast(^u8)input_ptr, input_len)
  input_str := string(input_data)
  csv.reader_init_with_string(parser, input_str)
  
  // Process records and pack using ASCII separators
  output_buf := slice.from_ptr(cast(^u8)output_ptr, output_capacity)
  output_builder := strings.builder_from_slice(output_buf[:0])
  
  rows_parsed := 0
  for record, idx in csv.iterator_next(parser) {
    if rows_parsed > 0 {
      strings.write_byte(&output_builder, 0x1E) // Record separator
    }
    
    for field, field_idx in record {
      if field_idx > 0 {
        strings.write_byte(&output_builder, 0x1F) // Field separator
      }
      strings.write_string(&output_builder, field)
    }
    rows_parsed += 1
    
    // Check if we're approaching capacity
    if strings.builder_len(output_builder) > output_capacity - 1024 {
      break
    }
  }
  
  bytes_written := strings.builder_len(output_builder)
  return (i64(rows_parsed) << 32) | i64(bytes_written)
}

@(export)
generate_csv_chunk :: proc "c" (
  generator_id: i32,
  input_ptr: rawptr,
  input_len: int,
  output_ptr: rawptr,
  output_capacity: int
) -> i64 {
  context = runtime.default_context()
  
  generator, ok := generators[generator_id]
  if !ok do return 0
  
  // Unpack tabular data from ASCII separators
  input_data := slice.from_ptr(cast(^u8)input_ptr, input_len)
  input_str := string(input_data)
  
  if len(input_str) == 0 do return 0
  
  // Split into records and fields
  record_strs := strings.split(input_str, string([]u8{0x1E}))
  defer delete(record_strs)
  
  // Setup output buffer as a stream
  output_buf := slice.from_ptr(cast(^u8)output_ptr, output_capacity)
  output_stream := io.to_writer(io.Writer{
    data = &output_buf,
    procedure = proc(writer_data: rawptr, data: []byte) -> (int, io.Error) {
      buf := cast(^[]u8)writer_data
      if len(buf^) + len(data) > cap(buf^) {
        return 0, .Short_Write
      }
      copy(buf^[len(buf^):], data)
      buf^ = buf^[:len(buf^) + len(data)]
      return len(data), nil
    },
  })
  
  csv.writer_init(generator, output_stream)
  
  rows_processed := 0
  for record_str in record_strs {
    if len(record_str) == 0 do continue
    
    fields := strings.split(record_str, string([]u8{0x1F}))
    defer delete(fields)
    
    err := csv.write(generator, fields)
    if err != nil do break
    
    rows_processed += 1
  }
  
  csv.writer_flush(generator)
  bytes_written := len(output_buf)
  
  return (i64(rows_processed) << 32) | i64(bytes_written)
}

@(export)
flush_csv_parser :: proc "c" (
  parser_id: i32,
  output_ptr: rawptr,
  output_capacity: int
) -> i64 {
  // For Odin CSV, flushing is handled automatically
  // Return 0 to indicate no additional data
  return 0
}

@(export)
parser_has_overflow :: proc "c" (parser_id: i32) -> bool {
  // Odin CSV handles complete records, no partial overflow
  return false
}

@(export)
get_recommended_output_size :: proc "c" (input_size: int) -> int {
  // Conservative estimate: input size * 1.5 for CSV formatting overhead
  return input_size + (input_size >> 1)
}
```

### Data Structure Definitions

```odin
ParseOptions :: struct {
  separator: u8,
  comment: u8,
  trim_leading_space: u8,
  lazy_quotes: u8,
  multiline_fields: u8,
  fields_per_record: i32,
  reserved: [21]u8,
}

StringifyOptions :: struct {
  separator: u8,
  use_crlf: u8,
  reserved: [14]u8,
}
```

## Data Serialization Formats

### Tabular Data Format (string[][])

**Fastest approach using ASCII separators:**
```
Record Separator: \x1E (ASCII Record Separator, 0x1E)
Field Separator:  \x1F (ASCII Unit Separator, 0x1F)

Example:
["a","b","c"],["d","e","f"] → "a\x1Fb\x1Fc\x1Ed\x1Fe\x1Ff"
```

**JavaScript Implementation:**
```typescript
// Pack: string[][] → Uint8Array
function packTabularData(rows: string[][]): Uint8Array {
  const text = rows.map(row => row.join('\x1F')).join('\x1E');
  return new TextEncoder().encode(text);
}

// Unpack: Uint8Array → string[][]
function unpackTabularData(data: Uint8Array): string[][] {
  const text = new TextDecoder().decode(data);
  if (!text) return [];
  return text.split('\x1E').map(row => row.split('\x1F'));
}
```

**Performance Benefits:**
- Single TextEncoder/TextDecoder allocation
- Native `.split()` optimization in V8
- No escaping/quoting overhead
- Linear memory access pattern

### LazyRow Data Format

**Reuse existing binary format:**
```typescript
// Pack: LazyRow[] → Uint8Array
function packLazyRows(rows: LazyRow[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let totalSize = 4; // row count header
  
  for (const row of rows) {
    const binary = row.toBinary();
    chunks.push(binary);
    totalSize += 4 + binary.length; // length prefix + data
  }
  
  const result = new Uint8Array(totalSize);
  const view = new DataView(result.buffer);
  view.setUint32(0, rows.length, true);
  
  let offset = 4;
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.length, true);
    result.set(chunk, offset + 4);
    offset += 4 + chunk.length;
  }
  
  return result;
}

// Unpack: Uint8Array → LazyRow[]
function unpackLazyRows(data: Uint8Array): LazyRow[] {
  const view = new DataView(data.buffer, data.byteOffset);
  const rowCount = view.getUint32(0, true);
  const rows: LazyRow[] = [];
  
  let offset = 4;
  for (let i = 0; i < rowCount; i++) {
    const length = view.getUint32(offset, true);
    const rowData = data.slice(offset + 4, offset + 4 + length);
    rows.push(LazyRow.fromBinary(rowData));
    offset += 4 + length;
  }
  
  return rows;
}
```

### Options Format

```
ParseOptions (32 bytes):
  - separator: u8 (ASCII, default ',')
  - comment: u8 (ASCII, 0 = none)
  - trim_leading_space: u8 (boolean)
  - lazy_quotes: u8 (boolean)
  - multiline_fields: u8 (boolean)
  - fields_per_record: i32 (-1 = variable, 0 = auto, >0 = fixed)
  - reserved: [21]u8

StringifyOptions (16 bytes):
  - separator: u8 (ASCII, default ',')
  - use_crlf: u8 (boolean)
  - reserved: [14]u8
```

## Wrapper Lifecycle Management

### Instance Creation and Disposal

```typescript
// Wrapper instances are created per transform and disposed when complete
const processor = await CsvProcessorFast.create();
try {
  // Process data...
  yield* processor.parseChunks(bytes, options);
} finally {
  processor.dispose(); // Frees all buffers and parser state
}
```

### Memory Growth Strategy

- **Input buffers**: Grow to accommodate largest chunk seen
- **Output buffers**: Grow based on WASM recommendations
- **No shrinking**: Buffers only grow, never shrink during processing
- **Cleanup**: All memory freed when wrapper disposed

### Buffer Sizing

- **Initial sizes**: Start with reasonable defaults (64KB input, 256KB output)
- **Growth triggers**: Reallocate when current buffer too small
- **Size calculation**: Use WASM `get_recommended_output_size()` for output buffers
- **Pathological data**: Large allocations cleaned up at transform completion

## TypeScript Wrapper Implementation

### CsvProcessorFast Class

```typescript
class CsvProcessorFast {
  private wasmInstance: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private parserId: number = 0;
  private generatorId: number = 0;
  private inputBuffer: number = 0;
  private outputBuffer: number = 0;
  private inputCapacity = 0;
  private outputCapacity = 0;

  static async create(): Promise<CsvProcessorFast> {
    // Load WASM module and create instance
    // Similar to foundation example pattern
  }

  async *parseChunks(
    bytes: AsyncIterable<Uint8Array>, 
    options?: CsvParseOptionsFast
  ): AsyncIterable<string[][]> {
    this.parserId = this.createCsvParser(options);
    
    try {
      for await (const chunk of bytes) {
        this.ensureInputBuffer(chunk.length);
        const recommendedOutput = this.getRecommendedOutputSize(chunk.length);
        this.ensureOutputBuffer(recommendedOutput);

        // Copy chunk to WASM memory
        new Uint8Array(this.memory.buffer).set(chunk, this.inputBuffer);

        // Process chunk
        const result = this.processCsvChunk(
          this.parserId, this.inputBuffer, chunk.length,
          this.outputBuffer, this.outputCapacity
        );

        const rowsParsed = Number(result >> 32n);
        const bytesWritten = Number(result & 0xFFFFFFFFn);

        if (rowsParsed > 0) {
          const outputData = new Uint8Array(
            this.memory.buffer, this.outputBuffer, bytesWritten
          );
          yield this.unpackTabularData(outputData);
        }
      }

      // Flush any remaining partial data
      if (this.parserHasOverflow(this.parserId)) {
        const result = this.flushCsvParser(
          this.parserId, this.outputBuffer, this.outputCapacity
        );
        
        if (Number(result >> 32n) > 0) {
          const outputData = new Uint8Array(
            this.memory.buffer, this.outputBuffer, Number(result & 0xFFFFFFFFn)
          );
          yield this.unpackTabularData(outputData);
        }
      }
    } finally {
      if (this.parserId) this.destroyCsvParser(this.parserId);
    }
  }

  async *generateChunks(
    rows: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>,
    options?: CsvStringifyOptionsFast
  ): AsyncIterable<Uint8Array> {
    this.generatorId = this.createCsvGenerator(options);
    
    try {
      for await (const item of rows) {
        // Determine data type and pack accordingly
        let packedData: Uint8Array;
        
        if (Array.isArray(item)) {
          if (item.length > 0 && Array.isArray(item[0])) {
            // string[][]
            packedData = this.packTabularData(item as string[][]);
          } else if (item.length > 0 && item[0] instanceof LazyRow) {
            // LazyRow[]
            packedData = this.packLazyRows(item as LazyRow[]);
          } else {
            // string[] - wrap in array
            packedData = this.packTabularData([item as string[]]);
          }
        } else if (item instanceof LazyRow) {
          // Single LazyRow - wrap in array
          packedData = this.packLazyRows([item]);
        } else {
          // Fallback - treat as single string[]
          packedData = this.packTabularData([item as string[]]);
        }

        this.ensureInputBuffer(packedData.length);
        const recommendedOutput = this.getRecommendedOutputSize(packedData.length);
        this.ensureOutputBuffer(recommendedOutput);

        // Copy packed data to WASM memory
        new Uint8Array(this.memory.buffer).set(packedData, this.inputBuffer);

        // Generate CSV
        const result = this.generateCsvChunk(
          this.generatorId, this.inputBuffer, packedData.length,
          this.outputBuffer, this.outputCapacity
        );

        const bytesWritten = Number(result & 0xFFFFFFFFn);
        if (bytesWritten > 0) {
          yield new Uint8Array(
            this.memory.buffer.slice(this.outputBuffer, this.outputBuffer + bytesWritten)
          );
        }
      }
    } finally {
      if (this.generatorId) this.destroyCsvGenerator(this.generatorId);
    }
  }

  dispose(): void {
    if (this.inputBuffer) this.freeBuffer(this.inputBuffer);
    if (this.outputBuffer) this.freeBuffer(this.outputBuffer);
    if (this.parserId) this.destroyCsvParser(this.parserId);
    if (this.generatorId) this.destroyCsvGenerator(this.generatorId);
  }

  private ensureInputBuffer(requiredSize: number): void {
    if (requiredSize > this.inputCapacity) {
      if (this.inputBuffer) this.freeBuffer(this.inputBuffer);
      this.inputCapacity = requiredSize;
      this.inputBuffer = this.allocInputBuffer(this.inputCapacity);
    }
  }

  private ensureOutputBuffer(requiredSize: number): void {
    if (requiredSize > this.outputCapacity) {
      if (this.outputBuffer) this.freeBuffer(this.outputBuffer);
      this.outputCapacity = requiredSize;
      this.outputBuffer = this.allocOutputBuffer(this.outputCapacity);
    }
  }

  // WASM function wrappers (implementation details)
  private allocInputBuffer(size: number): number { 
    return (this.wasmInstance.exports.alloc_input_buffer as Function)(size);
  }
  
  private allocOutputBuffer(size: number): number { 
    return (this.wasmInstance.exports.alloc_output_buffer as Function)(size);
  }
  
  private freeBuffer(ptr: number): void { 
    (this.wasmInstance.exports.free_buffer as Function)(ptr);
  }
  
  private createCsvParser(options?: CsvParseOptionsFast): number { 
    const optionsPtr = this.packParseOptions(options);
    try {
      return (this.wasmInstance.exports.create_csv_parser as Function)(optionsPtr);
    } finally {
      if (optionsPtr) this.freeBuffer(optionsPtr);
    }
  }
  
  private createCsvGenerator(options?: CsvStringifyOptionsFast): number { 
    const optionsPtr = this.packStringifyOptions(options);
    try {
      return (this.wasmInstance.exports.create_csv_generator as Function)(optionsPtr);
    } finally {
      if (optionsPtr) this.freeBuffer(optionsPtr);
    }
  }
  
  private destroyCsvParser(parserId: number): void { 
    (this.wasmInstance.exports.destroy_csv_parser as Function)(parserId);
  }
  
  private destroyCsvGenerator(generatorId: number): void { 
    (this.wasmInstance.exports.destroy_csv_generator as Function)(generatorId);
  }
  
  private processCsvChunk(parserId: number, inputPtr: number, inputLen: number, outputPtr: number, outputCapacity: number): bigint { 
    return (this.wasmInstance.exports.process_csv_chunk as Function)(
      parserId, inputPtr, inputLen, outputPtr, outputCapacity
    );
  }
  
  private generateCsvChunk(generatorId: number, inputPtr: number, inputLen: number, outputPtr: number, outputCapacity: number): bigint { 
    return (this.wasmInstance.exports.generate_csv_chunk as Function)(
      generatorId, inputPtr, inputLen, outputPtr, outputCapacity
    );
  }
  
  private flushCsvParser(parserId: number, outputPtr: number, outputCapacity: number): bigint { 
    return (this.wasmInstance.exports.flush_csv_parser as Function)(
      parserId, outputPtr, outputCapacity
    );
  }
  
  private parserHasOverflow(parserId: number): boolean { 
    return (this.wasmInstance.exports.parser_has_overflow as Function)(parserId);
  }
  
  private getRecommendedOutputSize(inputSize: number): number { 
    return (this.wasmInstance.exports.get_recommended_output_size as Function)(inputSize);
  }

  // Data packing/unpacking methods
  private packTabularData(rows: string[][]): Uint8Array {
    const text = rows.map(row => row.join('\x1F')).join('\x1E');
    return new TextEncoder().encode(text);
  }

  private unpackTabularData(data: Uint8Array): string[][] {
    const text = new TextDecoder().decode(data);
    if (!text) return [];
    return text.split('\x1E').map(row => row.split('\x1F'));
  }

  private packLazyRows(rows: LazyRow[]): Uint8Array {
    const chunks: Uint8Array[] = [];
    let totalSize = 4; // row count header
    
    for (const row of rows) {
      const binary = row.toBinary();
      chunks.push(binary);
      totalSize += 4 + binary.length; // length prefix + data
    }
    
    const result = new Uint8Array(totalSize);
    const view = new DataView(result.buffer);
    view.setUint32(0, rows.length, true);
    
    let offset = 4;
    for (const chunk of chunks) {
      view.setUint32(offset, chunk.length, true);
      result.set(chunk, offset + 4);
      offset += 4 + chunk.length;
    }
    
    return result;
  }

  private unpackLazyRows(data: Uint8Array): LazyRow[] {
    const view = new DataView(data.buffer, data.byteOffset);
    const rowCount = view.getUint32(0, true);
    const rows: LazyRow[] = [];
    
    let offset = 4;
    for (let i = 0; i < rowCount; i++) {
      const length = view.getUint32(offset, true);
      const rowData = data.slice(offset + 4, offset + 4 + length);
      rows.push(LazyRow.fromBinary(rowData));
      offset += 4 + length;
    }
    
    return rows;
  }

  private packParseOptions(options?: CsvParseOptionsFast): number {
    if (!options) return 0;
    
    const buffer = this.allocInputBuffer(32);
    const view = new DataView(this.memory.buffer, buffer, 32);
    
    view.setUint8(0, options.separator?.charCodeAt(0) ?? 44); // ','
    view.setUint8(1, options.comment?.charCodeAt(0) ?? 0);
    view.setUint8(2, options.trimLeadingSpace ? 1 : 0);
    view.setUint8(3, options.lazyQuotes ? 1 : 0);
    view.setUint8(4, 1); // multiline_fields = true (for compatibility)
    view.setInt32(5, options.fieldsPerRecord ?? -1, true);
    
    return buffer;
  }

  private packStringifyOptions(options?: CsvStringifyOptionsFast): number {
    if (!options) return 0;
    
    const buffer = this.allocInputBuffer(16);
    const view = new DataView(this.memory.buffer, buffer, 16);
    
    view.setUint8(0, options.separator?.charCodeAt(0) ?? 44); // ','
    view.setUint8(1, options.crlf ? 1 : 0);
    
    return buffer;
  }
}
```

### Transform Function Implementation

```typescript
export function fromCsvToRowsFast(parseOptions?: CsvParseOptionsFast) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<string[][]> {
    const processor = await CsvProcessorFast.create();
    try {
      yield* processor.parseChunks(bytes, parseOptions);
    } finally {
      processor.dispose();
    }
  };
}

export function fromCsvToLazyRowsFast(parseOptions?: CsvParseOptionsFast) {
  return async function* (bytes: AsyncIterable<Uint8Array>): AsyncIterable<LazyRow[]> {
    const processor = await CsvProcessorFast.create();
    try {
      for await (const batch of processor.parseChunks(bytes, parseOptions)) {
        yield batch.map(row => LazyRow.fromStringArray(row));
      }
    } finally {
      processor.dispose();
    }
  };
}

export function toCsvFast(stringifyOptions?: CsvStringifyOptionsFast) {
  return async function* (
    data: AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>
  ): AsyncIterable<Uint8Array> {
    const processor = await CsvProcessorFast.create();
    try {
      yield* processor.generateChunks(data, stringifyOptions);
    } finally {
      processor.dispose();
    }
  };
}
```

## Performance Requirements

- Process 100MB+ CSV files efficiently
- Handle variable chunk sizes gracefully
- Memory usage grows only as needed, cleaned up per transform
- Streaming processing with minimal latency

## Implementation Plan

### Phase 1: Basic Parsing
- Implement `parse_csv_chunk` in Odin
- Handle quoted fields, escaping, basic RFC 4180 compliance
- TypeScript wrapper for `fromCsvToRowsFast()`

### Phase 2: LazyRow Integration
- Extend parser to output binary format compatible with LazyRow
- Implement `fromCsvToLazyRowsFast()`
- Performance benchmarking vs std/csv

### Phase 3: CSV Generation
- Implement `generate_csv_chunk` in Odin
- TypeScript wrapper for `toCsvFast()`
- Round-trip testing (parse → generate → parse)

### Phase 4: Advanced Features
- Custom separators, comments, trim options
- Performance optimization and profiling
- Integration testing with existing proc pipelines

## File Structure

```
odin/
├── SPEC.md                 # This specification
├── src/
│   ├── csv.odin           # Main CSV parsing logic
│   ├── memory.odin        # Memory management utilities
│   ├── parsing.odin       # Core parsing utilities (DRY functions)
│   └── exports.odin       # WASM export functions
├── tests/
│   ├── test_parsing.odin  # Unit tests for parsing utilities
│   ├── test_csv.odin      # Integration tests for CSV logic
│   ├── test_memory.odin   # Memory management tests
│   └── test_runner.odin   # Test framework runner
├── build.sh               # Build script with tests
└── test.sh                # Run tests only

src/transforms/
├── csv-fast.ts            # TypeScript wrapper
├── csv-fast.test.ts       # Compatibility tests
└── csv-fast.bench.ts      # Performance benchmarks

wasm/
└── csv.wasm               # Built WASM module
```

## Testing Strategy

### Odin Unit Tests
- **Core Function Tests**: Test individual parsing utilities (field extraction, quote handling, escape sequences)
- **State Machine Tests**: Test parser state transitions with edge cases
- **Memory Management Tests**: Verify no leaks in buffer allocation/deallocation
- **UTF-8 Boundary Tests**: Test chunk splitting across multibyte characters
- **Performance Tests**: Verify allocation-free inner loops with `@(no_instrumentation)`

### TypeScript Integration Tests
- **Compatibility Tests**: Identical behavior to std/csv on same inputs
- **Memory Leak Detection**: Track WASM memory growth over multiple operations
- **Performance Tests**: Throughput comparison with existing transforms
- **Edge Case Tests**: Malformed CSV, encoding issues, memory limits
- **Integration Tests**: Full pipeline testing with proc library

### Memory Requirements
- **Allocation-Free Inner Loops**: Core parsing loops must not allocate during field processing
- **Grow-Only Buffers**: Buffers grow as needed but never shrink during processing
- **Leak Detection**: All allocated memory must be freed when transform completes
- **Memory Profiling**: Track peak memory usage and allocation patterns

### Code Quality Requirements
- **DRY Principle**: Reusable functions for common operations (quote handling, field parsing)
- **Single Responsibility**: Each function has one clear purpose for better testability
- **Inline Optimization**: Use `@(inline)` for hot path functions to eliminate call overhead
- **Test Coverage**: Unit tests for all public functions and critical internal utilities
