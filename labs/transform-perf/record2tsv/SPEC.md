# Record → TSV Performance Bottleneck Investigation

## Executive Summary

This experiment creates minimal, isolated implementations of `record2tsv` transformation to identify and profile the common performance bottleneck affecting all flatdata operations.

## Format Specifications

### Record Format (Input)
- **Field separator**: `0x1f` (ASCII Unit Separator, 31 decimal)
- **Record separator**: `0x1e` (ASCII Record Separator, 30 decimal)
- **Data values can contain**: `\t`, `\r`, `\n` (valid for formats like CSV)
- **Purpose**: Universal interchange format that preserves all characters

### TSV Format (Output)
- **Field separator**: `\t` (0x09, tab character)
- **Record separator**: `\n` (0x0a, newline)
- **Data values cannot contain**: `\t`, `\r`, or `\n`
- **Purpose**: Simple text format for tools that expect tab-delimited data

### Transformation Requirements

**Character Conversions:**
1. `0x1f` → `\t` (field separator conversion)
2. `0x1e` → `\n` (record separator conversion)

**Validation (for "correct" implementations):**
- **Error if found in data**: `\t` (0x09), `\r` (0x0d), or `\n` (0x0a)
- **Error message format**: `"Invalid character 0x09 (tab) found in record 1,234,567"`
- **Record numbering**: 1-based, with locale-formatted thousands separators
- **Record counting**: Increment on each `0x1e` encountered

**Why validation matters:**
- Record format can legitimately contain tabs, CR, and LF in data values
- TSV format cannot - these characters have structural meaning
- Users must pre-process data if they want to strip/replace these characters
- We fail fast with clear error messages rather than producing invalid TSV

## Implementation Approaches

We implement **six approaches** to compare:

### Fast (no validation):
1. **TypeScript (Uint8Array)** - Direct byte manipulation
2. **TypeScript (TextDecoder + replaceAll)** - String-based
3. **WASM (Standard Loop)** - Simple Odin loop
4. **WASM (SIMD)** - 128-bit vectorized processing

### Correct (with validation):
5. **WASM (Correct)** - Scalar loop with validation and record tracking
6. **WASM (SIMD Correct)** - SIMD with validation and record tracking

## Prerequisites

⚠️ **Complete `labs/stdout-async/` experiment first!**

If `toStdout()` is a bottleneck due to synchronous writes, this experiment's results will be misleading.

#### 1. Uint8Array Byte Manipulation

**Approach**: Direct byte-level replacement in Uint8Array chunks

```typescript
function* record2tsvBytes(source: AsyncIterable<Uint8Array>): AsyncIterable<Uint8Array> {
  for await (const chunk of source) {
    // In-place modification
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === 0x1e) {  // Record separator
        chunk[i] = 0x09;         // Tab
      }
    }
    yield chunk;
  }
}

// Usage
await enumerate(Deno.stdin.readable)
  .transform(record2tsvBytes)
  .toStdout();
```

**Characteristics**:
- No string allocation
- Direct memory manipulation
- Minimal overhead
- Should be very fast for simple operations

#### 2. TextDecoder + String replaceAll

**Approach**: Decode to string, use regex replacement

```typescript
async function* record2tsvString(source: AsyncIterable<Uint8Array>): AsyncIterable<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  for await (const chunk of source) {
    const text = decoder.decode(chunk, { stream: true });
    const replaced = text.replaceAll(/\x1e/g, '\t');
    yield encoder.encode(replaced);
  }
}

// Usage
await enumerate(Deno.stdin.readable)
  .transform(record2tsvString)
  .toStdout();
```

**Characteristics**:
- String allocation overhead
- Regex engine involvement
- More idiomatic JavaScript
- May benefit from V8 optimizations

**Note**: This approach doesn't handle `\r\n` → `\n` normalization, but that's acceptable for this experiment.

### WASM Implementations (Odin)

#### 3. Standard Loop Implementation

```odin
// Export for WASM
record_to_tsv :: proc "c" (data: [^]u8, length: u32) {
    for i in 0..<length {
        if data[i] == 0x1e {  // Record separator
            data[i] = '\t'     // Tab
        }
    }
}
```

**Characteristics**:
- Simple, predictable performance
- Baseline for WASM comparison
- Should be very fast for such simple operations

#### 4. SIMD Implementation

**WASM SIMD Capabilities**:
- 128-bit SIMD vectors (v128)
- Operations: load, store, compare, select, arithmetic
- Odin has SIMD intrinsics support

**Approach**:
```odin
record_to_tsv_simd :: proc "c" (data: [^]u8, length: u32) {
    // Process 16 bytes at a time (128 bits)
    record_vector := simd.splat_u8x16(0x1e)
    tab_vector := simd.splat_u8x16('\t')
    
    i: u32 = 0
    // Main SIMD loop - process 16 bytes per iteration
    for i + 16 <= length {
        chunk := simd.load_u8x16(&data[i])
        mask := simd.eq_u8x16(chunk, record_vector)
        result := simd.select(mask, tab_vector, chunk)
        simd.store_u8x16(&data[i], result)
        i += 16
    }
    
    // Handle remaining bytes with scalar code
    for i < length {
        if data[i] == 0x1e {
            data[i] = '\t'
        }
        i += 1
    }
}
```

**Buffer Alignment Considerations**:
- SIMD operations may require aligned memory
- Need to ensure input buffer size is suitable for SIMD processing
- Consider padding or handling unaligned starts/ends

**Loop Unrolling**:
- Question: Does WASM SIMD benefit from manual loop unrolling?
- If yes, unroll to process 512 bits (4 × 128-bit vectors) per iteration
- This would process 64 bytes per loop iteration
- Trade-off: Code size vs potential ILP (instruction-level parallelism)

### Memory Management

**Strategy: Growing Buffer with WASM Allocation**

The key challenge: JavaScript doesn't know where it's safe to write in WASM's linear memory. Solution: Let WASM manage its own memory.

#### Memory Flow

1. **WASM allocates**: Odin exports `allocate(size) -> ptr` that returns a safe memory location
2. **JavaScript writes**: Cast WASM memory to `Uint8Array` at the returned pointer
3. **WASM processes**: Operate in-place on the data
4. **JavaScript reads**: Same `Uint8Array` view contains the result
5. **Reuse or reallocate**: Keep buffer for next chunk, or grow if needed

#### Growing Buffer Pattern

```typescript
class WasmTransformer {
    private wasm: WebAssembly.Instance;
    private memory: WebAssembly.Memory;
    private bufferPtr: number = 0;
    private bufferCapacity: number = 0;
    
    constructor(wasm: WebAssembly.Instance) {
        this.wasm = wasm;
        this.memory = wasm.exports.memory as WebAssembly.Memory;
    }
    
    transform(chunk: Uint8Array): Uint8Array {
        // Reallocate if we need more space
        if (chunk.length > this.bufferCapacity) {
            this.reallocate(chunk.length);
        }
        
        // Get view into WASM memory at our buffer location
        const buffer = new Uint8Array(
            this.memory.buffer, 
            this.bufferPtr, 
            chunk.length
        );
        
        // Copy data into WASM memory
        buffer.set(chunk);
        
        // Transform in-place
        (this.wasm.exports.record_to_tsv as Function)(
            this.bufferPtr, 
            chunk.length
        );
        
        // Return a copy (buffer is a view, we need to copy before next iteration)
        return buffer.slice(0, chunk.length);
    }
    
    private reallocate(newSize: number) {
        // Free old buffer if it exists
        if (this.bufferPtr !== 0) {
            (this.wasm.exports.free_buffer as Function)(this.bufferPtr);
        }
        
        // Allocate new buffer
        this.bufferPtr = (this.wasm.exports.allocate as Function)(newSize);
        this.bufferCapacity = newSize;
    }
    
    close() {
        // Cleanup on disposal
        if (this.bufferPtr !== 0) {
            (this.wasm.exports.free_buffer as Function)(this.bufferPtr);
            this.bufferPtr = 0;
            this.bufferCapacity = 0;
        }
    }
}

// Usage in transform function
async function* record2tsv(source: AsyncIterable<Uint8Array>) {
    const transformer = new WasmTransformer(wasmInstance);
    
    try {
        for await (const chunk of source) {
            yield transformer.transform(chunk);
        }
    } finally {
        transformer.close();
    }
}
```

#### Odin Side: Memory Exports

```odin
// Export allocator
@(export)
allocate :: proc "c" (size: u32) -> u32 {
    // Allocate from WASM heap
    data := make([]u8, size)
    return u32(uintptr(raw_data(data)))
}

@(export)
free_buffer :: proc "c" (ptr: u32) {
    // Note: Proper cleanup in WASM is tricky with Odin's context system
    // For this experiment, we may skip this or use a simple arena allocator
}

@(export)
record_to_tsv :: proc "c" (ptr: u32, length: u32) {
    data := ([^]u8)(uintptr(ptr))[:length]
    
    for i in 0..<length {
        if data[i] == 0x1e {  // Record separator
            data[i] = '\t'     // Tab
        }
    }
}
```

#### Key Insights

**Typical Case** (uniform chunk sizes):
- One allocation at start
- All subsequent chunks reuse the same buffer
- Zero allocation overhead after first chunk

**Edge Case** (growing chunks):
- Reallocate only when needed
- Old buffer freed, new larger buffer allocated
- Rare in practice (streams usually have consistent chunk sizes)

**Last Chunk** (smaller):
- No reallocation needed
- Just use less of the buffer (pass actual length to WASM)

**Memory Safety**:
- WASM manages its own memory space
- JavaScript never guesses offsets
- No risk of corrupting WASM stack/heap

#### Performance Considerations

**Overhead Sources**:
1. **Copy-in**: `buffer.set(chunk)` - copying data into WASM memory
2. **Copy-out**: `buffer.slice()` - copying result back to JavaScript
3. **Allocation**: Only on first chunk or when growing
4. **WASM call**: Function call overhead (should be minimal)

**What We'll Measure**:
- Is the copy overhead significant?
- Does buffer reuse help?
- Is WASM call overhead measurable?
- Does chunk size affect performance?

#### Wrapper Class Benefits

**Clean API**:
- Encapsulates memory management complexity
- Automatic cleanup via `close()` or try/finally
- Matches production code patterns

**Minimal Overhead**:
- Class instantiation: one-time cost
- Method calls: inline-able by V8
- No closures or complex state

**Testability**:
- Easy to swap implementations
- Can mock for testing
- Clear lifecycle management

This pattern is **not self-destructive** - it's good engineering! The overhead is negligible compared to the actual work being done.

## Performance Metrics

### What to Measure

1. **End-to-end throughput** (MB/s) for each implementation:
   - TypeScript (Uint8Array)
   - TypeScript (TextDecoder + replaceAll)
   - WASM (Standard loop)
   - WASM (SIMD)

2. **Time breakdown** (for WASM implementations):
   - Deno stream reading
   - Deno → WASM data transfer
   - WASM processing time
   - WASM → Deno data transfer
   - Deno stream writing

3. **Comparison factors**:
   - Different chunk sizes (4KB, 16KB, 64KB, 256KB)
   - Against current flatdata implementation
   - TypeScript vs WASM overhead

### Success Criteria

1. **Identify bottleneck**: Clear data showing where time is spent
2. **Baseline performance**: All implementations should be fast (>200 MB/s expected for simple byte replacement)
3. **TypeScript viability**: Determine if pure TypeScript is competitive for simple operations
4. **SIMD benefit**: Quantify speedup (if any) from SIMD
5. **Actionable insights**: Clear recommendations for optimizing production code

## Research Questions

### WASM SIMD

1. What SIMD intrinsics does Odin expose for WASM target?
2. Does WASM SIMD require specific compiler flags?
3. What's the browser/runtime support? (Deno support confirmed)
4. Are there alignment requirements for SIMD loads/stores?

### Loop Unrolling

1. Does WASM benefit from manual loop unrolling?
2. What's the optimal unroll factor? (2x, 4x, 8x?)
3. Does the WASM JIT already do this optimization?

### Memory Model

1. Can we use WebAssembly.Memory for zero-copy transfers?
2. What's the overhead of crossing the WASM boundary?
3. Are there better patterns for streaming data through WASM?

## Project Structure

```
labs/tsv-record-perf/
├── SPEC.md                          # This document
├── README.md                        # Quick start guide
├── data/                            # Test data (gitignored)
│   ├── generate.ts                  # Data generation script
│   ├── small.record                 # 1 MB test file
│   ├── medium.record                # 100 MB test file
│   └── large.record                 # 1 GB test file
├── typescript/
│   ├── record2tsv-bytes.ts         # Uint8Array implementation
│   ├── record2tsv-string.ts        # TextDecoder + replaceAll
│   └── benchmark-ts.ts             # TypeScript benchmarks
├── odin/
│   ├── src/
│   │   ├── main.odin               # WASM exports
│   │   ├── standard.odin           # Loop implementation
│   │   └── simd.odin               # SIMD implementation
│   └── build.sh                    # Build script
├── deno/
│   ├── record2tsv-wasm.ts          # WASM wrapper (standard)
│   ├── record2tsv-wasm-simd.ts     # WASM wrapper (SIMD)
│   └── benchmark-wasm.ts           # WASM benchmarks
└── results/
    ├── profile-YYYY-MM-DD.md       # Profiling results
    └── *.txt, *.csv                # Raw data (gitignored)
```

## Test Data Generation

**Script**: `data/generate.ts`

Generate record-format test files with predictable content:

```typescript
// Generate record-format test data
// Record format uses 0x1e (record separator) instead of newlines
function generateRecordData(sizeInMB: number, outputPath: string) {
    const fields = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
    const recordSep = String.fromCharCode(0x1e);
    
    // Create a record: field1\tfield2\tfield3<RS>
    const record = fields.join("\t") + recordSep;
    const bytesPerRecord = new TextEncoder().encode(record).length;
    const totalBytes = sizeInMB * 1024 * 1024;
    const recordCount = Math.floor(totalBytes / bytesPerRecord);
    
    const file = Deno.openSync(outputPath, { write: true, create: true, truncate: true });
    const encoder = new TextEncoder();
    const recordBytes = encoder.encode(record);
    
    for (let i = 0; i < recordCount; i++) {
        file.writeSync(recordBytes);
    }
    
    file.close();
}

// Generate test files
generateRecordData(1, "data/small.record");      // 1 MB
generateRecordData(100, "data/medium.record");   // 100 MB
generateRecordData(1000, "data/large.record");   // 1 GB
```

**Note**: Test data files are gitignored (`labs/*/data/`) and generated on-demand. The record format uses `0x1e` (ASCII record separator) between records and `\t` (tab) between fields.

## Implementation Phases

### Phase 1: TypeScript Implementations
1. Implement Uint8Array byte manipulation version
2. Implement TextDecoder + replaceAll version
3. Create benchmark harness
4. Establish TypeScript performance baselines

### Phase 2: WASM Standard Loop
1. Set up Odin project with WASM target
2. Implement simple loop-based transformer
3. Create Deno wrapper with minimal overhead
4. Compare against TypeScript baselines

### Phase 3: WASM SIMD
1. Research Odin SIMD intrinsics for WASM
2. Implement SIMD version with proper alignment
3. Test with/without loop unrolling
4. Compare performance against all other implementations

### Phase 4: Profiling & Analysis
1. Detailed timing of each pipeline stage
2. Vary chunk sizes to find optimal transfer size
3. Compare against production flatdata
4. Document findings and recommendations

## Expected Outcomes

1. **Clear bottleneck identification**: Data showing whether the issue is:
   - WASM invocation overhead
   - Data transfer costs
   - Memory allocation patterns
   - Stream chunking behavior
   - Or actual processing time

2. **TypeScript vs WASM comparison**: Determine if WASM overhead is worth it for simple operations

3. **String vs byte-level comparison**: Whether TextDecoder/replaceAll is competitive with direct byte manipulation

4. **SIMD viability assessment**: Whether SIMD provides meaningful speedup for this workload

5. **Optimization recommendations**: Specific, actionable improvements for production code

6. **Performance baseline**: Reference implementation for future optimizations

## Notes

- This is experimental code, not for production use
- Assumes hardware SIMD support (no fallback needed)
- Focus on clarity and measurability over robustness
- All code should be heavily commented for learning purposes

## References

- [WebAssembly SIMD Proposal](https://github.com/WebAssembly/simd)
- [Odin SIMD Intrinsics](https://odin-lang.org/) (to be researched)
- Current flatdata implementation: `odin/src/exports.odin`
- Existing WASM examples: `labs/wasm/examples/`
