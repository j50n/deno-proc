# Async Stdout Performance Experiment

## Executive Summary

Profile and optimize `toStdout()` to determine if synchronous stdout writes are a performance bottleneck. Current implementation uses synchronous writes to prevent console.log interference, but this may significantly impact throughput for high-speed data transformations.

## Problem Statement

The current `toStdout()` implementation is synchronous to ensure output ordering when mixed with `console.log()` statements. However, this design choice may be causing significant performance overhead:

- **Synchronous writes block** the transformation pipeline
- **Backpressure is artificial** - waiting for stdout instead of natural flow control
- **High-throughput scenarios suffer** - each chunk waits for the previous to complete

**Hypothesis**: Switching to async (non-blocking) stdout writes could significantly improve throughput, at the cost of potential console.log interleaving.

## Objectives

1. **Profile current implementation**: Measure throughput of synchronous `toStdout()`
2. **Implement async version**: Create non-blocking stdout writer
3. **Quantify performance difference**: Measure throughput improvement
4. **Document trade-offs**: Speed vs console.log safety
5. **Provide recommendations**: When to use sync vs async

## Current Implementation

```typescript
// Synchronous toStdout() - blocks on each write
async toStdout(): Promise<void> {
    for await (const chunk of this.iterable) {
        await Deno.stdout.writeSync(chunk);  // Blocks until written
    }
}
```

**Characteristics**:
- ✅ Safe with console.log - output never interleaves
- ✅ Predictable ordering
- ❌ Blocks pipeline on each chunk
- ❌ Can't overlap I/O with computation

## Proposed Async Implementation

### Approach 1: Simple Async Write

```typescript
async toStdoutAsync(): Promise<void> {
    for await (const chunk of this.iterable) {
        await Deno.stdout.write(chunk);  // Non-blocking
    }
}
```

**Characteristics**:
- ✅ Non-blocking writes
- ✅ Simple implementation
- ⚠️ console.log may interleave
- ⚠️ Still waits for each write to complete

### Approach 2: Buffered Async (Like writeTo)

```typescript
async toStdoutAsync(): Promise<void> {
    const writer = Deno.stdout.writable.getWriter();
    try {
        for await (const chunk of this.iterable) {
            await writer.write(chunk);
        }
    } finally {
        writer.releaseLock();
    }
}
```

**Characteristics**:
- ✅ Uses WritableStream API
- ✅ Better buffering behavior
- ✅ Matches `writeTo()` pattern
- ⚠️ console.log may interleave

### Approach 3: Fire-and-Forget with Queue

```typescript
async toStdoutAsync(): Promise<void> {
    const writer = Deno.stdout.writable.getWriter();
    const writePromises: Promise<void>[] = [];
    
    try {
        for await (const chunk of this.iterable) {
            // Don't await - queue the write
            writePromises.push(writer.write(chunk));
            
            // Limit queue depth to prevent memory issues
            if (writePromises.length > 10) {
                await writePromises.shift();
            }
        }
        
        // Wait for all writes to complete
        await Promise.all(writePromises);
    } finally {
        writer.releaseLock();
    }
}
```

**Characteristics**:
- ✅ Maximum parallelism
- ✅ Overlaps I/O with computation
- ⚠️ More complex
- ⚠️ Requires queue depth management

## Performance Metrics

### What to Measure

1. **Throughput (MB/s)**:
   - Current synchronous `toStdout()`
   - Approach 1: Simple async
   - Approach 2: Buffered async (writeTo pattern)
   - Approach 3: Queued writes

2. **Latency**:
   - Time to first byte
   - Time to completion

3. **CPU utilization**:
   - Is the process blocked on I/O?
   - Can we overlap computation?

4. **Memory usage**:
   - Does queuing increase memory pressure?

### Test Scenarios

1. **Fast producer** (reading from memory):
   ```typescript
   await enumerate(fastDataSource)
       .toStdout();  // vs toStdoutAsync()
   ```

2. **Piped to file** (fast consumer):
   ```bash
   deno run script.ts > /dev/null
   ```

3. **Piped to slow consumer**:
   ```bash
   deno run script.ts | pv -L 10M > /dev/null
   ```

4. **With transformations**:
   ```typescript
   await enumerate(source)
       .map(transform)
       .filter(predicate)
       .toStdout();  // vs toStdoutAsync()
   ```

## Trade-offs

### Synchronous (Current)

**Pros**:
- Safe with console.log/console.error
- Predictable output ordering
- Simple mental model

**Cons**:
- Blocks pipeline on each write
- Lower throughput for high-speed data
- Artificial backpressure

### Asynchronous (Proposed)

**Pros**:
- Higher throughput
- Natural backpressure from stdout
- Better CPU utilization

**Cons**:
- console.log may interleave with output
- Slightly more complex implementation
- Need to document the trade-off

## Recommendations Framework

Based on results, provide guidance:

**Use synchronous `toStdout()` when**:
- Mixing data output with console.log debugging
- Output ordering is critical
- Throughput is not a concern (<50 MB/s)

**Use asynchronous `toStdoutAsync()` when**:
- High-throughput data processing (>100 MB/s)
- No console.log in the pipeline
- Performance is critical

**Consider**:
- Making async the default, sync the special case?
- Adding a flag: `toStdout({ sync: true })`?
- Documenting the trade-off prominently?

## Implementation Plan

### Phase 1: Baseline Measurement
1. Create benchmark harness
2. Measure current synchronous `toStdout()` throughput
3. Test with various data sources and chunk sizes

### Phase 2: Implement Async Versions
1. Approach 1: Simple async write
2. Approach 2: Buffered async (writeTo pattern)
3. Approach 3: Queued writes (if needed)

### Phase 3: Comparative Analysis
1. Benchmark all approaches
2. Test with real-world scenarios
3. Measure console.log interleaving frequency
4. Document trade-offs

### Phase 4: Integration Decision
1. Choose best approach based on data
2. Update production code
3. Document usage guidelines
4. Update examples and tests

## Project Structure

```
labs/stdout-async/
├── SPEC.md                      # This document
├── README.md                    # Quick reference
├── data/                        # Test data (gitignored)
│   ├── generate.ts              # Data generation script
│   ├── small.txt                # 1 MB test file
│   ├── medium.txt               # 100 MB test file
│   └── large.txt                # 1 GB test file
├── current-sync.ts              # Current toStdout() implementation
├── async-simple.ts              # Approach 1: Simple async
├── async-buffered.ts            # Approach 2: Buffered (writeTo pattern)
├── async-queued.ts              # Approach 3: Queued writes
├── benchmark.ts                 # Performance measurement
├── test-interleaving.ts         # Test console.log behavior
└── results/
    ├── profile-YYYY-MM-DD.md    # Results and analysis
    └── *.txt, *.csv             # Raw data (gitignored)
```

## Test Data Generation

**Script**: `data/generate.ts`

Generate test files of various sizes with predictable content:

```typescript
// Generate test data - simple repeating pattern
function generateTestData(sizeInMB: number, outputPath: string) {
    const line = "The quick brown fox jumps over the lazy dog.\n";
    const bytesPerLine = new TextEncoder().encode(line).length;
    const totalBytes = sizeInMB * 1024 * 1024;
    const lineCount = Math.floor(totalBytes / bytesPerLine);
    
    const file = Deno.openSync(outputPath, { write: true, create: true, truncate: true });
    const encoder = new TextEncoder();
    
    for (let i = 0; i < lineCount; i++) {
        file.writeSync(encoder.encode(line));
    }
    
    file.close();
}

// Generate test files
generateTestData(1, "data/small.txt");      // 1 MB
generateTestData(100, "data/medium.txt");   // 100 MB
generateTestData(1000, "data/large.txt");   // 1 GB
```

**Note**: Test data files are gitignored (`labs/*/data/`) and generated on-demand.

## Success Criteria

1. **Clear performance data**: Throughput measurements for all approaches
2. **Quantified improvement**: X% faster with async (if any)
3. **Trade-off documentation**: Clear guidance on when to use each
4. **Production recommendation**: Data-driven decision on default behavior
5. **No regressions**: Ensure async version doesn't break existing use cases

## Expected Outcomes

### Scenario A: Significant Improvement (>2x faster)
- Async becomes the default
- Sync version kept for special cases
- Document the trade-off prominently

### Scenario B: Modest Improvement (20-50% faster)
- Provide both options
- Let users choose based on needs
- Default stays sync for safety

### Scenario C: No Significant Difference
- Keep current implementation
- Document that stdout is not the bottleneck
- Focus optimization efforts elsewhere

## Relationship to Other Experiments

**Prerequisite for**: `labs/tsv-record-perf/`

The WASM transformation experiment needs to know if stdout is a bottleneck. If we're measuring WASM performance while stdout is blocking, we're profiling the wrong thing.

**Fix this first**, then measure WASM on a level playing field.

## Notes

- This is about stdout specifically, not general file I/O
- `writeTo()` already uses async pattern - we're aligning `toStdout()` with it
- The console.log trade-off is real but may be acceptable for production pipelines
- Consider adding a `--sync-stdout` flag for debugging scenarios

## References

- Current `toStdout()` implementation: `src/enumerable.ts`
- `writeTo()` pattern: `src/enumerable.ts`
- Deno stdout API: https://deno.land/api?s=Deno.stdout
