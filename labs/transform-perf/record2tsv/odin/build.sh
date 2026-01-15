#!/bin/bash
set -e

echo "🔨 Building record2tsv.wasm from Odin source..."

# Check and vet the Odin code for WASM target
echo "🔍 Checking Odin code for WASM..."
odin check record2tsv.odin -file -vet -vet-style -vet-semicolon -target:js_wasm32

# Strip unneeded semicolons
echo "🎨 Formatting Odin code..."
odin strip-semicolon record2tsv.odin -file -target:js_wasm32

# Build the WASM
odin build record2tsv.odin -file \
    -o:size \
    -target:js_wasm32 \
    -out:record2tsv.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "✅ Build successful!"
echo "📦 Generated: record2tsv.wasm ($(du -h record2tsv.wasm | cut -f1))"
