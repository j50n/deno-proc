# Implementation Guidelines

Each implementation must provide the same interface for fair comparison.

## Required Interface

```typescript
import { enumerate } from "@j50n/proc";

// Each implementation exports a transform function
export function createParser(separator: ',' | '\t'): TransformStream<string, Record<string, string>>;

// Usage pattern for all implementations:
// await enumerate(csvFile).transform(createParser(',')).collect()

export interface BenchmarkResult {
  implementation: string;
  format: 'csv' | 'tsv';
  columns: number;
  rowsProcessed: number;
  durationMs: number;
  memoryPeakMB: number;
  throughputRowsPerSec: number;
  throughputMBPerSec: number;
}
```

## Implementation Checklist

- [ ] Implements `StreamParser` interface
- [ ] Handles parsing errors gracefully
- [ ] Streams data (no full file loading)
- [ ] Includes `benchmark.ts` entry point
- [ ] Isolated dependencies in local `deno.json`
- [ ] README with implementation details

## Directory Structure

```
implementation-name/
├── README.md           # Implementation details
├── deno.json          # Local dependencies
├── mod.ts             # Main parser export
├── benchmark.ts       # Benchmark entry point
├── parser.ts          # Core parsing logic
└── worker.ts          # (if using workers)
```

## Performance Considerations

- **Memory**: Minimize allocations, reuse objects
- **CPU**: Avoid unnecessary string operations
- **I/O**: Optimize buffer sizes for streaming
- **Concurrency**: Balance parallelism vs overhead
