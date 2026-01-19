#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Running Odin tests..."
odin test src/csv -out:/tmp/csv_test

echo ""
echo "Building WASM module..."
echo ""

# Build flatdata.wasm (scalar only)
echo "  - Building flatdata.wasm..."
odin build src -out:target/flatdata.wasm -target:js_wasm32 -o:speed \
    -extra-linker-flags:"--import-memory --strip-all" \
    -vet -vet-style -vet-semicolon

echo ""
echo "Build and tests completed successfully!"
echo ""
ls -lh target/flatdata.wasm

# Copy to project root wasm/ directory
echo ""
echo "Copying to /wasm/ directory..."
cp target/flatdata.wasm ../wasm/
