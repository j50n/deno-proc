#!/bin/bash
set -e

cd "$(dirname "$0")"

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
