#!/bin/bash
set -e

echo "Building js_wasm64p32 processor..."
odin build simple_processor.odin -file -target:js_wasm64p32 -o:speed -out:simple_processor_64.wasm

echo "Build complete: simple_processor_64.wasm"
