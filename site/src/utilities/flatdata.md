# flatdata CLI

**flatdata** is a command-line utility for converting between tabular data
formats. It's distributed as part of proc and runs on the same transforms as
`@j50n/proc/transforms`; CSV to TSV and back run entirely in WebAssembly.

## Installation

```bash
# Install globally with required permissions
deno install -g --allow-read --allow-write -n flatdata jsr:@j50n/proc@{{gitv}}/flatdata
```

This installs `flatdata` globally, making it available from any terminal.

For pipeline-only use (stdin/stdout), you can install without file permissions:

```bash
deno install -g -n flatdata jsr:@j50n/proc@{{gitv}}/flatdata
```

This restricts flatdata to streaming mode—no direct file reading or writing.

To verify the installation:

```bash
flatdata --help
flatdata --version
```

## Why flatdata?

CSV parsing is CPU-intensive. Running it in a separate process keeps your main
application responsive and puts a second core to work, and the output can be a
format that is trivial to read downstream.

## Formats

| Format     | Description                              | Use Case                |
| ---------- | ---------------------------------------- | ----------------------- |
| **csv**    | RFC 4180 comma-separated values          | Standard interchange    |
| **tsv**    | Tab-separated values                     | Simple data, no quoting |
| **record** | `\x1F` between fields, `\x1E` after rows | Fast processing         |

The **record** format uses ASCII control characters that don't appear in text
data, so a field can hold anything else, nothing is escaped, and
`row.split('\x1F')` gives you the fields.

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

```bash
flatdata csv2tsv [options]       # CSV → TSV, in WebAssembly
flatdata tsv2csv [options]       # TSV → CSV, in WebAssembly
flatdata csv2record [options]    # CSV → record
flatdata tsv2record [options]    # TSV → record
flatdata record2csv [options]    # record → CSV
flatdata record2tsv [options]    # record → TSV
```

Options:

- `-d, --separator <char>` - CSV field separator (default: `,`)
- `--crlf` - CRLF line endings in CSV output (`tsv2csv`, `record2csv`)
- `-i, --input <file>` - Input file (default: stdin)
- `-o, --output <file>` - Output file (default: stdout)

TSV can't hold a tab, CR or LF inside a field, so `csv2tsv` and `record2tsv`
stop with an error naming the row and field of the first one. Reading CSV or
TSV, lines end in LF or CRLF, and any other CR (outside quotes, in CSV) stops
with the same kind of error.

## Using with proc

The real power comes from combining flatdata with proc's pipeline capabilities.

### Direct Format Conversion

```bash
# Convert CSV to TSV
cat data.csv | flatdata csv2tsv > data.tsv

# Convert TSV to CSV
flatdata tsv2csv -i data.tsv -o data.csv

# European CSV (semicolon) to TSV
flatdata csv2tsv -d ';' -i euro.csv -o data.tsv
```

### Basic Pipeline

Records end in `\x1E`, not newlines, so read them with `fromRecordToRows` rather
than `.lines`:

```typescript
import { enumerate } from "jsr:@j50n/proc";
import { fromRecordToRows } from "jsr:@j50n/proc/transforms";

// Parse CSV in a subprocess, process records in JS
const results = await enumerate([csvData])
  .run("flatdata", "csv2record")
  .transform(fromRecordToRows())
  .flatten()
  .filter((fields) => fields[2] === "active")
  .map((fields) => ({ id: fields[0], name: fields[1] }))
  .collect();
```

### Processing Large Files

```typescript
import { read } from "jsr:@j50n/proc";
import { fromRecordToRows } from "jsr:@j50n/proc/transforms";

// Stream a large CSV through flatdata
await read("huge.csv")
  .run("flatdata", "csv2record")
  .transform(fromRecordToRows())
  .flatten()
  .map((fields) => processRow(fields))
  .forEach((result) => console.log(result));
```

### With enumerate for Indexing

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToRows } from "jsr:@j50n/proc/transforms";

// Number each row
await run("cat", "data.csv")
  .run("flatdata", "csv2record")
  .transform(fromRecordToRows())
  .flatten()
  .enum()
  .map(([fields, index]) => `${index + 1}: ${fields[0]}`)
  .toStdout();
```

## Transforms for Record Format

proc provides transforms to convert between the record format and JavaScript
objects.

### fromRecordToRows

Convert record-delimited bytes to string arrays:

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToRows } from "jsr:@j50n/proc/transforms";

await run("flatdata", "csv2record", "-i", "data.csv")
  .transform(fromRecordToRows())
  .flatten()
  .filter((row) => row[2] === "active")
  .forEach((row) => console.log(row[0], row[1]));
```

### fromRecordToLazyRows

Convert record-delimited bytes to LazyRow objects (more efficient for wide
rows):

```typescript
import { run } from "jsr:@j50n/proc";
import { fromRecordToLazyRows } from "jsr:@j50n/proc/transforms";

await run("flatdata", "csv2record", "-i", "wide.csv")
  .transform(fromRecordToLazyRows())
  .flatten()
  .filter((row) => row.getField(0) === "active")
  .forEach((row) => console.log(row.getField(1), row.getField(5)));
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
  .map((row) => [row[0], row[1].toUpperCase(), row[2]])
  .transform(toRecord())
  .run("flatdata", "record2csv")
  .toStdout();
```

## European CSV (Semicolon-Delimited)

```bash
# Convert European CSV to US CSV
flatdata csv2record -d ';' -i euro.csv | flatdata record2csv -o us.csv
```

## Tips

1. **Pipe through flatdata** to offload CPU work from your main process
2. **Use record format** for intermediate processing - it's trivial to parse
3. **Convert CSV and TSV directly** with `csv2tsv` and `tsv2csv`; they are the
   fastest commands

## Architecture

flatdata reads CSV with a [streaming RFC 4180 reader](../appendix/csv-parser.md)
written in Embedded Swift and compiled to WebAssembly.
