#!/bin/bash
set -e

echo "Building adaptive line processor WASM..."
odin build line_processor_adaptive.odin -file -target:freestanding_wasm32 -o:speed -out:line_processor_adaptive.wasm

echo "Build complete: line_processor_adaptive.wasm"
