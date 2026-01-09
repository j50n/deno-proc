#!/bin/bash

# Build the Odin code to WASM
echo "Building Odin to WASM..."
odin build odin -target:js_wasm32 -out:counter -o:speed

if [ -f "counter.wasm" ]; then
    echo "✓ WASM build successful: counter.wasm"
    
    # Run the Deno launcher (no --allow-net needed now)
    echo "Running Deno launcher..."
    deno run --allow-read --allow-write launcher.ts
else
    echo "✗ WASM build failed"
    exit 1
fi
