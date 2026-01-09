# FlatText Testing Experiments

This folder contains experimental tests and examples for the FlatText CSV/TSV converter.

## Usage

Test the CLI tool:
```bash
# From project root
echo "name,age,city" | deno run --allow-read flattext.ts csv2tsv
```

Test the API:
```bash
deno run --allow-read test-api.ts
```

## Test Data

Create sample CSV files here to test various scenarios:
- Large files
- Complex CSV with quotes and escapes
- Different delimiters
- Edge cases
