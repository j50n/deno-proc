#!/bin/bash
set -e

SCRIPT_DIR="$(dirname "$0")"
BENCH_DIR="$SCRIPT_DIR/../../benchmarks"

cd "$BENCH_DIR"

echo "Formatting benchmark code..."
deno fmt flatdata-throughput.ts

echo ""
echo "Linting benchmark code..."
deno lint flatdata-throughput.ts

echo ""
echo "Type checking benchmark code..."
deno check flatdata-throughput.ts

echo ""
echo "Running flatdata throughput benchmarks..."
echo ""
deno run --allow-read --allow-write=/tmp/flatdata-bench --allow-run=deno flatdata-throughput.ts
