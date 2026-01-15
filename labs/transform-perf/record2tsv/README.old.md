# Record → TSV Performance Experiment

Minimal implementations to isolate and profile the performance bottleneck in flatdata transformations.

## Format Specifications

### Record Format (Input)
- **Field separator**: `0x1f` (ASCII Unit Separator)
- **Record separator**: `0x1e` (ASCII Record Separator)
- **Can contain**: `\t`, `\r`, `\n` in data values (valid for formats like CSV)

### TSV Format (Output)
- **Field separator**: `\t` (0x09, tab character)
- **Record separator**: `\n` (0x0a, newline)
- **Cannot contain**: `\t`, `\r`, or `\n` in data values

### Transformation Rules
1. Convert `0x1f` → `\t` (field separator)
2. Convert `0x1e` → `\n` (record separator)
3. **Validate**: Error if `\t`, `\r`, or `\n` found in data values
4. **Error reporting**: Include 1-based record number with locale-formatted thousands separators

Example error: `"Invalid character 0x09 (tab) found in record 1,234,567"`

## Quick Start

```bash
# Generate test data
deno run --allow-write data/generate.ts

# Run benchmarks
./run.sh

# Statistical analysis
deno run --allow-read typescript/benchmark-stats.ts
```

## Implementations

### Correct (with validation):
- **TypeScript bytes-correct** - Byte manipulation with validation
- **WASM correct** - Scalar loop with validation and record tracking
- **WASM SIMD correct** - SIMD with validation and record tracking

### Fast (no validation):
- **TypeScript bytes** - Direct byte manipulation
- **WASM** - Simple Odin loop
- **WASM SIMD** - 128-bit vectorized processing

## Goal

Identify whether the bottleneck is:
- Data transfer between Deno and WASM
- WASM invocation overhead
- Memory allocation patterns
- Or actual processing time

Also determine if TypeScript is competitive for simple operations.

See [SPEC.md](SPEC.md) for complete details.
