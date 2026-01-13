# flatdata CLI

**flatdata** is a high-performance command-line utility for converting between tabular data formats. It's distributed as part of proc and uses WebAssembly for near-native parsing speed.

## Installation

```bash
# Install globally with required permissions
deno install -g --allow-read --allow-write -n flatdata jsr:@j50n/proc/flatdata
```

This installs `flatdata` globally, making it available from any terminal.

To verify the installation:

```bash
flatdata --help
flatdata --version
```

## Why flatdata?

CSV parsing is CPU-intensive. When processing large files, the parsing step can become a bottleneck. flatdata solves this by:

1. **Offloading parsing to a separate process** - Your main application stays responsive
2. **Using WASM for speed** - ~7x faster than pure JavaScript, about half native speed
3. **Streaming design** - Handles files of any size with constant memory

The key insight: by converting CSV to a simple binary format (record), downstream processing becomes trivial string splits instead of complex CSV parsing.

## Performance

| Implementation | Throughput |
|----------------|------------|
| Native (Odin) | ~550 MB/s |
| flatdata -w (WASM) | ~150 MB/s |
| Pure JavaScript | ~20 MB/s |

For a 1GB CSV file:
- WASM: ~7 seconds
- Pure JS: ~50 seconds

## Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **csv** | RFC 4180 comma-separated values | Standard interchange |
| **tsv** | Tab-separated values | Simple data, no quoting |
| **record** | Binary: `\x1F` field, `\x1E` record | Fast processing |
| **lazyrow** | Same as record | Streaming row access |

The **record** format is the key to performance. It uses ASCII control characters that never appear in text data:
- `\x1F` (Unit Separator) between fields
- `\x1E` (Record Separator) between rows

This makes parsing trivial: `row.split('\x1F')` gives you fields instantly.

## Basic Usage

```bash
# Convert CSV to record format
cat data.csv | flatdata csv2record -w > data.rec

# Convert back to CSV
flatdata record2csv < data.rec > output.csv

# Full pipeline
cat huge.csv | flatdata csv2record -w | ./process | flatdata record2csv > results.csv
```

## Commands

### CSV/TSV Input

```bash
flatdata csv2record [options]    # CSV → record
flatdata csv2lazyrow [options]   # CSV → lazyrow
flatdata tsv2record [options]    # TSV → record
flatdata tsv2lazyrow [options]   # TSV → lazyrow
```

Options:
- `-d, --separator <char>` - Field separator (CSV only, default: `,`)
- `-c, --columns <n>` - Expected column count (fail if mismatch)
- `-s, --strict` - Fail on parse errors
- `-w, --wasm` - Use WASM for faster parsing
- `-i, --input <file>` - Input file (default: stdin)
- `-o, --output <file>` - Output file (default: stdout)

### Record/Lazyrow Output

```bash
flatdata record2csv [options]    # record → CSV
flatdata record2tsv [options]    # record → TSV
flatdata lazyrow2csv [options]   # lazyrow → CSV
flatdata lazyrow2tsv [options]   # lazyrow → TSV
```

Options:
- `-d, --separator <char>` - Field separator (CSV only, default: `,`)
- `-q, --quote-all` - Quote all fields
- `-i, --input <file>` - Input file (default: stdin)
- `-o, --output <file>` - Output file (default: stdout)

## Using with proc

The real power comes from combining flatdata with proc's pipeline capabilities.

### Basic Pipeline

```typescript
import { run, enumerate } from "jsr:@j50n/proc";

// Parse CSV in a subprocess, process records in JS
const results = await run("flatdata", "csv2record", "-w")
  .writeToStdin(csvData)
  .lines
  .map(record => record.split('\x1F'))  // Split into fields
  .filter(fields => fields[2] === 'active')
  .map(fields => ({ id: fields[0], name: fields[1] }))
  .collect();
```

### Processing Large Files

```typescript
import { read, run } from "jsr:@j50n/proc";

// Stream a large CSV through flatdata
await read("huge.csv")
  .run("flatdata", "csv2record", "-w")
  .lines
  .map(record => {
    const fields = record.split('\x1F');
    return processRow(fields);
  })
  .forEach(result => console.log(result));
```

### With enumerate for Indexing

```typescript
import { run, enumerate } from "jsr:@j50n/proc";

// Number each row
await run("cat", "data.csv")
  .run("flatdata", "csv2record", "-w")
  .lines
  .enum()
  .map(([record, index]) => {
    const fields = record.split('\x1F');
    return `${index + 1}: ${fields[0]}`;
  })
  .toStdout();
```

### Bidirectional Pipeline

```typescript
import { run } from "jsr:@j50n/proc";

// CSV → process → CSV
const output = await run("flatdata", "csv2record", "-w", "-i", "input.csv")
  .lines
  .map(record => {
    const fields = record.split('\x1F');
    fields[1] = fields[1].toUpperCase();  // Transform field
    return fields.join('\x1F');
  })
  .run("flatdata", "record2csv")
  .lines
  .collect();
```

## Transforms for Record Format

proc provides transforms to convert between the binary record format and JavaScript objects.

### fromRecordToRows

Convert record-delimited bytes to string arrays:

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToRows } from "jsr:@j50n/proc/transforms";

const rows = await run("flatdata", "csv2record", "-w", "-i", "data.csv")
  .transform(fromRecordToRows())
  .collect();

// rows is string[][]
for (const row of rows) {
  console.log(row[0], row[1]);  // Access fields by index
}
```

### fromRecordToLazyRows

Convert record-delimited bytes to LazyRow objects (more efficient for wide rows):

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToLazyRows } from "jsr:@j50n/proc/transforms";

await run("flatdata", "csv2record", "-w", "-i", "wide.csv")
  .transform(fromRecordToLazyRows())
  .map(row => row.getField(0))  // Only parse the first field
  .toStdout();
```

### toRecord

Convert string arrays to record format:

```typescript
import { enumerate } from "jsr:@j50n/proc";
import { toRecord } from "jsr:@j50n/proc/transforms";

const rows = [
  ["Alice", "30", "Engineer"],
  ["Bob", "25", "Designer"],
];

await enumerate(rows)
  .transform(toRecord())
  .run("flatdata", "record2csv")
  .toStdout();
```

## LazyRow for Memory Efficiency

LazyRow defers field parsing until accessed - ideal when you only need a few fields from wide rows:

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToLazyRows } from "jsr:@j50n/proc/transforms";

await run("flatdata", "csv2record", "-w", "-i", "huge.csv")
  .transform(fromRecordToLazyRows())
  .filter(row => row.columnCount > 5)  // O(1) column count
  .map(row => row.getField(0))          // Only parse field 0
  .take(100)
  .toStdout();
```

LazyRow methods:
- `columnCount` - Number of fields (O(1), no parsing)
- `getField(n)` - Get nth field as string (parses on demand)
- `toArray()` - Get all fields as string[]

## European CSV (Semicolon-Delimited)

```bash
# Convert European CSV to US CSV
flatdata csv2record -w -d ';' -i euro.csv | flatdata record2csv -o us.csv
```

## Validation

```bash
# Fail if any row doesn't have exactly 10 columns
flatdata csv2record -w --columns 10 --strict -i data.csv > /dev/null
```

## Tips

1. **Always use `-w`** for large files - WASM is 7x faster
2. **Pipe through flatdata** to offload CPU work from your main process
3. **Use record format** for intermediate processing - it's trivial to parse
4. **LazyRow** when you only need a few fields from wide rows
5. **Validate early** with `--columns` and `--strict` to catch data issues

## Architecture

flatdata is built with:
- **Odin** - Systems programming language for the parser
- **WebAssembly** - Portable, near-native performance
- **Cliffy** - CLI framework for Deno

The WASM module is compiled with `--import-memory` so JavaScript controls memory allocation, enabling efficient streaming without copies.
