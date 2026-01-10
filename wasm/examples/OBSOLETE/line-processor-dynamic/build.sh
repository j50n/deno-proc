#!/bin/bash
set -e

echo "Building dynamic line processor WASM..."
odin build line_processor_dynamic.odin -file -target:freestanding_wasm32 -o:speed -out:line_processor_dynamic.wasm

echo "Build complete: line_processor_dynamic.wasm"
