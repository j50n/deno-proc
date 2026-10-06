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

Results vary with CPU and load; compare runs on a quiet machine.
