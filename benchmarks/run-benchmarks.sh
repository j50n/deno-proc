#!/usr/bin/env bash
# Run benchmarks for deno-proc transforms

set -e

cd "$(dirname "$0")"

echo "=== deno-proc Benchmarks ==="
echo ""

echo "Available benchmarks:"
echo ""
echo "  1. flatdata-statistical.ts    - Statistical analysis of flatdata WASM transforms"
echo "  2. transforms-throughput.ts   - Throughput comparison of all transforms"
echo ""
echo "Usage:"
echo "  ./run-benchmarks.sh [1|2]"
echo ""

if [ $# -eq 0 ]; then
    echo "Running all benchmarks..."
    echo ""
    
    echo "=== Flatdata Statistical Benchmarks ==="
    deno run --allow-read --allow-write=/tmp/ flatdata-statistical.ts
    
    echo ""
    echo "=== Transform Throughput Benchmarks ==="
    deno run --allow-read transforms-throughput.ts
    
    echo ""
    echo "All benchmarks complete!"
elif [ "$1" = "1" ]; then
    deno run --allow-read --allow-write=/tmp/ flatdata-statistical.ts
elif [ "$1" = "2" ]; then
    deno run --allow-read transforms-throughput.ts
else
    echo "Invalid option: $1"
    exit 1
fi
