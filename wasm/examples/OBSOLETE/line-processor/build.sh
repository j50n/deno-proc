#!/bin/bash
set -e

echo "Building line processor WASM..."
odin build . -target:freestanding_wasm32 -o:speed -no-bounds-check -out:line_processor.wasm

echo "Build complete: line_processor.wasm"
