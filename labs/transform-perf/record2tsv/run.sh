#!/bin/bash
set -e

echo "🔨 Building and benchmarking tsv-record-perf..."
echo ""

# Build Odin WASM
echo "📦 Building Odin WASM modules..."
cd odin

echo "  - record2tsv.wasm"
odin build record2tsv.odin -file \
    -o:speed \
    -target:js_wasm32 \
    -out:record2tsv.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "  - record2tsv-correct.wasm"
odin build record2tsv-correct.odin -file \
    -o:speed \
    -target:js_wasm32 \
    -out:record2tsv-correct.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "  - record2tsv-simd.wasm"
odin build record2tsv-simd.odin -file \
    -o:speed \
    -target:js_wasm32 \
    -out:record2tsv-simd.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "  - record2tsv-simd-correct.wasm"
odin build record2tsv-simd-correct.odin -file \
    -o:speed \
    -target:js_wasm32 \
    -out:record2tsv-simd-correct.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "  - record2tsv-simd-unrolled.wasm"
odin build record2tsv-simd-unrolled.odin -file \
    -o:speed \
    -target:js_wasm32 \
    -out:record2tsv-simd-unrolled.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "✅ All WASM modules built"
cd ..

echo ""
echo "🎨 Formatting TypeScript..."
deno fmt typescript/

echo ""
echo "🔍 Linting TypeScript..."
deno lint typescript/

echo ""
echo "✅ Type checking TypeScript..."
deno check typescript/*.ts

echo ""
echo "🚀 Running benchmarks..."
deno run --allow-read typescript/benchmark.ts

echo ""
echo "🎉 All done!"
