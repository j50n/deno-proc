#!/bin/bash
set -e

echo "Building external memory line processor WASM..."
odin build line_processor_external.odin -file -target:freestanding_wasm32 -o:speed -out:line_processor_external.wasm

echo "Build complete: line_processor_external.wasm"
