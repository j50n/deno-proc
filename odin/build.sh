#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Running Odin tests..."
odin test src/csv -out:/tmp/csv_test

echo "Building flatdata WASM module..."
odin build src -out:../wasm/flatdata.wasm -target:js_wasm32 -o:speed \
    -extra-linker-flags:"--import-memory --strip-all"

echo "Build and tests completed successfully!"
ls -la ../wasm/flatdata.wasm
