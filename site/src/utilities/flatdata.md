# flatdata CLI

**flatdata** is a high-performance command-line utility for converting between tabular data formats. It's distributed as part of proc and uses WebAssembly for near-native parsing speed.

## Installation

```bash
# Install globally with required permissions
deno install -g --allow-read --allow-write -n flatdata jsr:@j50n/proc/flatdata
```

This installs `flatdata` globally, making it available from any terminal.

For pipeline-only use (stdin/stdout), you can install without file permissions:

```bash
deno install -g -n flatdata jsr:@j50n/proc/flatdata
```

This restricts flatdata to streaming mode—no direct file reading or writing.

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
| flatdata (WASM) | ~330 MB/s |
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
| **lazyrow** | Binary with length-prefixed fields | Efficient random field access |

The **record** format is the key to performance. It uses ASCII control characters that never appear in text data:
- `\x1F` (Unit Separator) between fields
- `\x1E` (Record Separator) between rows

This makes parsing trivial: `row.split('\x1F')` gives you fields instantly.

## Basic Usage

```bash
# Convert CSV to record format
cat data.csv | flatdata csv2record > data.rec

# Convert back to CSV
flatdata record2csv < data.rec > output.csv

# Full pipeline
cat huge.csv | flatdata csv2record | ./process | flatdata record2csv > results.csv
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

### Record ↔ Lazyrow Conversion

```bash
flatdata record2lazyrow [options]  # record → lazyrow
flatdata lazyrow2record [options]  # lazyrow → record
```

Options:
- `-i, --input <file>` - Input file (default: stdin)
- `-o, --output <file>` - Output file (default: stdout)

## Using with proc

The real power comes from combining flatdata with proc's pipeline capabilities.

### Basic Pipeline

```typescript
import { run, enumerate } from "jsr:@j50n/proc";

// Parse CSV in a subprocess, process records in JS
const results = await run("flatdata", "csv2record")
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
  .run("flatdata", "csv2record")
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
  .run("flatdata", "csv2record")
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
const output = await run("flatdata", "csv2record", "-i", "input.csv")
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

await run("flatdata", "csv2record", "-i", "data.csv")
  .transform(fromRecordToRows())
  .flatten()
  .filter(row => row[2] === "active")
  .forEach(row => console.log(row[0], row[1]));
```

### fromRecordToLazyRows

Convert record-delimited bytes to LazyRow objects (more efficient for wide rows):

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToLazyRows } from "jsr:@j50n/proc/transforms";

await run("flatdata", "csv2record", "-i", "wide.csv")
  .transform(fromRecordToLazyRows())
  .flatten()
  .filter(row => row.getField(0) === "active")
  .forEach(row => console.log(row.getField(1), row.getField(5)));
```

### fromLazyRowBinary

Convert binary lazyrow format (from `csv2lazyrow`) to LazyRow objects:

```typescript
import { run } from "jsr:@j50n/proc";
import { fromLazyRowBinary } from "jsr:@j50n/proc/transforms";

await run("flatdata", "csv2lazyrow", "-i", "wide.csv")
  .transform(fromLazyRowBinary())
  .flatten()
  .filter(row => row.getField(2) === "error")
  .forEach(row => console.log(`${row.getField(0)}: ${row.getField(3)}`));
```

### toRecord

Convert row data to record format for piping to flatdata:

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToRows, toRecord } from "jsr:@j50n/proc/transforms";

// Transform CSV: uppercase the second field
await run("flatdata", "csv2record", "-i", "input.csv")
  .transform(fromRecordToRows())
  .flatten()
  .map(row => [row[0], row[1].toUpperCase(), row[2]])
  .transform(toRecord())
  .run("flatdata", "record2csv")
  .toStdout();
```

## LazyRow for Memory Efficiency

LazyRow defers field parsing until accessed - ideal when you only need a few fields from wide rows:

```typescript
import { run } from "jsr:@j50n/proc";
import { fromLazyRowBinary } from "jsr:@j50n/proc/transforms";

await run("flatdata", "csv2lazyrow", "-i", "huge.csv")
  .transform(fromLazyRowBinary())
  .flatten()
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
flatdata csv2record -d ';' -i euro.csv | flatdata record2csv -o us.csv
```

## Validation

```bash
# Fail if any row doesn't have exactly 10 columns
flatdata csv2record --columns 10 --strict -i data.csv > /dev/null
```

## Tips

1. **Pipe through flatdata** to offload CPU work from your main process
2. **Use record format** for intermediate processing - it's trivial to parse
3. **LazyRow** when you only need a few fields from wide rows
4. **Validate early** with `--columns` and `--strict` to catch data issues

## Architecture

flatdata uses a [custom RFC 4180 CSV parser](../appendix/csv-parser.md) written in Odin and compiled to WebAssembly. We needed a *push parser*—one that accepts arbitrary chunks of input and tracks state across calls—because WASM modules can't pull data from JavaScript. Odin's standard library CSV parser is a pull parser that expects to read from a file or complete buffer.
