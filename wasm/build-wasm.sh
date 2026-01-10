#!/bin/bash
set -e

echo "Building Odin WASM module..."
cd odin-src
odin build streaming.odin -file -target:freestanding_wasm32 -out:../streaming.wasm -debug
cd ..

echo "WASM module built successfully: streaming.wasm"
