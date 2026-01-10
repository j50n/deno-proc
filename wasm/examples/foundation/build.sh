#!/bin/bash
set -e

echo "🔨 Building math_demo.wasm from Odin source..."

# First run Odin unit tests
echo "🧪 Running Odin unit tests..."
odin test odin/demo.test.odin -file -vet -vet-style -vet-semicolon

# Check and vet the Odin code for WASM target
echo "🔍 Checking Odin code for WASM..."
odin check odin/demo.odin -file -vet -vet-style -vet-semicolon -target:js_wasm32

# Strip unneeded semicolons
echo "🎨 Formatting Odin code..."
odin strip-semicolon odin/demo.odin -file -target:js_wasm32

# Build the WASM
odin build odin/demo.odin -file \
    -target:js_wasm32 \
    -out:demo.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "✅ Build successful!"
echo "📦 Generated: demo.wasm ($(du -h demo.wasm | cut -f1))"

echo ""
echo "🎨 Formatting TypeScript files..."
deno fmt *.ts

echo "🔍 Linting TypeScript files..."
deno lint *.ts

echo "✅ Type checking TypeScript files..."
deno check *.ts

echo ""
echo "🧪 Running integration tests..."
deno test --allow-read demo.test.ts

echo "🎉 All checks and tests passed!"
