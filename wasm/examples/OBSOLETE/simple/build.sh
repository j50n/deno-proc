#!/bin/bash
set -e

echo "Building WASM module..."
odin build uppercase.odin -file -target:freestanding_wasm32 -out:uppercase.wasm -debug

echo "WASM module built: uppercase.wasm"
