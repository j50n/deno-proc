# Test Data

This directory contains generated test data files for benchmarking.

## Files (gitignored)

- `small.record` - 1 MB (record format)
- `medium.record` - 100 MB (record format)
- `large.record` - 1 GB (record format)

## Generate

```bash
deno run --allow-write generate.ts
```

All test data files are gitignored and generated on-demand.

## Record Format

Record format uses:
- `0x1e` (ASCII record separator) between records
- `\t` (tab) between fields within a record
