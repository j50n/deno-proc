# Benchmarks

## Transform Throughput (`transforms-throughput.ts`)

MB/s for every transform in `@j50n/proc/transforms`: reading CSV, TSV, record
and JSON into rows and LazyRows, filtering LazyRows, converting CSV and TSV
bytes to each other, and writing rows. Each figure is the median of seven runs
after a warm-up.

```bash
deno run --allow-read benchmarks/transforms-throughput.ts            # realistic data
deno run --allow-read benchmarks/transforms-throughput.ts --simple   # field{c}_{r} data
deno run --allow-read benchmarks/transforms-throughput.ts toCsv      # names containing "toCsv"
```

The data is 100,000 rows of 20 fields. By default the fields are realistic:
words with UTF-8 in them, and about one in ten quoted for a comma, a `""` escape
or an embedded newline. `--simple` gives every reader an easy time, which is
worth seeing too, but realistic data is what the numbers in the docs come from.

## Against Other JavaScript (`compare.ts`)

proc against `@std/csv`, Papa Parse, csv-parse and csv-stringify, and a
hand-written TypeScript reader, on the same realistic data. Before timing, it
checks that every contender produces the same rows. The others parse the whole
file as one string; proc streams it in 64 KB chunks.

```bash
deno run --allow-read --allow-env benchmarks/compare.ts           # everything
deno run --allow-read --allow-env benchmarks/compare.ts "CSV to"  # a group or name
```

Results vary with CPU and load; compare runs on a quiet machine.
