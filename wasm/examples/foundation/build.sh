#!/bin/bash
set -e

echo "🔨 Building math_demo.wasm from Odin source..."

# First run Odin unit tests
echo "🧪 Running Odin unit tests..."
odin test odin/math_demo.test.odin -file -vet -vet-style -vet-semicolon

# Check and vet the Odin code for WASM target
echo "🔍 Checking Odin code for WASM..."
odin check odin/math_demo.odin -file -vet -vet-style -vet-semicolon -target:freestanding_wasm32

# Strip unneeded semicolons
echo "🎨 Formatting Odin code..."
odin strip-semicolon odin/math_demo.odin -file -target:freestanding_wasm32

# Build the WASM
odin build odin/math_demo.odin -file \
    -target:freestanding_wasm32 \
    -out:math-demo.wasm \
    -debug

echo "✅ Build successful!"
echo "📦 Generated: math-demo.wasm ($(du -h math-demo.wasm | cut -f1))"

echo ""
echo "🎨 Formatting TypeScript files..."
deno fmt *.ts

echo "🔍 Linting TypeScript files..."
deno lint *.ts

echo "✅ Type checking TypeScript files..."
deno check *.ts

echo ""
echo "🧪 Running integration tests..."
deno test --allow-read math-demo.test.ts

echo "🎉 All checks and tests passed!"
