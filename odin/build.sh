#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Running Odin tests..."
odin test src/csv -out:/tmp/csv_test

echo ""
echo "Building WASM modules..."
echo ""

# Build scalar version (no SIMD)
echo "  - Building flatdata-scalar.wasm..."
odin build src -out:wasm/flatdata-scalar.wasm -target:js_wasm32 -o:speed \
    -extra-linker-flags:"--import-memory --strip-all" \
    -vet -vet-style -vet-semicolon

# Build SIMD version
echo "  - Building flatdata-simd.wasm..."
odin build src -out:wasm/flatdata-simd.wasm -target:js_wasm32 -o:speed \
    -target-features:simd128 \
    -extra-linker-flags:"--import-memory --strip-all" \
    -define:FLATDATA_SIMD=true \
    -vet -vet-style -vet-semicolon

echo ""
echo "Build and tests completed successfully!"
echo ""
ls -lh wasm/flatdata*.wasm

# Verify SIMD instructions
echo ""
echo "Verifying SIMD instructions..."
if wasm2wat wasm/flatdata-scalar.wasm 2>/dev/null | grep -q "v128\|i8x16\|i16x8\|i32x4"; then
    echo "❌ ERROR: Scalar build contains SIMD instructions!"
    exit 1
else
    echo "✅ Scalar build: No SIMD instructions (correct)"
fi

if wasm2wat wasm/flatdata-simd.wasm 2>/dev/null | grep -q "i8x16"; then
    echo "✅ SIMD build: Contains SIMD instructions (correct)"
else
    echo "❌ ERROR: SIMD build missing SIMD instructions!"
    exit 1
fi

# Copy to project root wasm/ directory
echo ""
echo "Copying to /wasm/ directory..."
cp wasm/flatdata-scalar.wasm ../wasm/
cp wasm/flatdata-simd.wasm ../wasm/
