# flatdata - Tabular Data Format Converter

A CLI utility for converting between tabular data formats with both pure Deno and WASM implementations.

## Installation

```bash
deno install -g -A jsr:@j50n/proc/flatdata
```

## Usage

```bash
# CSV to record format (for fast downstream processing)
cat data.csv | flatdata csv2record

# With options
flatdata csv2record --separator ";" --columns 10 --strict -i data.csv

# Back to CSV
flatdata record2csv --separator "," -o output.csv

# Use WASM for speed
flatdata csv2record -w -i huge.csv | process_records | flatdata record2csv -o out.csv
```

## Subcommands

### CSV Input

```
flatdata csv2record [options]
flatdata csv2lazyrow [options]

Options:
  -d, --separator <char>   Field separator (default: ",")
  -c, --columns <n>        Expected column count (fail if mismatch)
  -s, --strict             Fail on parse errors (default: lenient)
      --comment <char>     Comment line prefix (skip these lines)
  -i, --input <file>       Input file (default: stdin)
  -o, --output <file>      Output file (default: stdout)
  -w, --wasm               Use WASM implementation (faster)
```

### TSV Input

```
flatdata tsv2record [options]
flatdata tsv2lazyrow [options]

Options:
  -c, --columns <n>        Expected column count (fail if mismatch)
  -s, --strict             Fail on parse errors (default: lenient)
  -i, --input <file>       Input file (default: stdin)
  -o, --output <file>      Output file (default: stdout)
  -w, --wasm               Use WASM implementation (faster)
```

### Record Input

```
flatdata record2csv [options]
flatdata record2tsv [options]

CSV Output Options:
  -d, --separator <char>   Field separator (default: ",")
  -q, --quote-all          Quote all fields (default: quote as needed)
  -i, --input <file>       Input file (default: stdin)
  -o, --output <file>      Output file (default: stdout)

TSV Output Options:
  -i, --input <file>       Input file (default: stdin)
  -o, --output <file>      Output file (default: stdout)
```

### Lazyrow Input

```
flatdata lazyrow2csv [options]
flatdata lazyrow2tsv [options]
flatdata lazyrow2record [options]

(Same options as record2csv/record2tsv)
```

### Record <-> Lazyrow Conversion

```
flatdata record2lazyrow [options]
flatdata lazyrow2record [options]

Options:
  -i, --input <file>       Input file (default: stdin)
  -o, --output <file>      Output file (default: stdout)
```

## Formats

| Format | Description | Wire Format |
|--------|-------------|-------------|
| csv | RFC 4180 comma-separated values | Text with quoting rules |
| tsv | Tab-separated values | Text, no quoting |
| record | Record-delimited text | Fields: `\x1F`, Records: `\x1E` |
| lazyrow | Binary format | Length-prefixed fields for random access |

## Examples

```bash
# Pipeline: offload CSV parsing to separate process
cat huge.csv | flatdata csv2record -w | ./my_processor | flatdata record2csv > out.csv

# Validate column count
flatdata csv2record --columns 10 --strict -i data.csv > /dev/null

# Convert semicolon-delimited European CSV
flatdata csv2record -d ";" -i euro.csv | flatdata record2csv -d "," -o us.csv

# TSV to CSV
flatdata tsv2record -i data.tsv | flatdata record2csv -o data.csv
```

## Performance

| Implementation | Throughput |
|----------------|------------|
| Native Odin | ~550 MB/s |
| Deno + WASM | ~125-270 MB/s |
| Deno pure | ~20 MB/s |

Use `-w` flag for large files to get WASM performance.
