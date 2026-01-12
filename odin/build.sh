#!/bin/bash
set -e

echo "Running Odin tests..."
odin test tests -out:test_runner

echo "Building CSV WASM module..."
odin build src -out:../wasm/csv.wasm -target:js_wasm32 -o:speed \
    -extra-linker-flags:"--import-memory --strip-all"

echo "Build and tests completed successfully!"
ls -la ../wasm/csv.wasm
