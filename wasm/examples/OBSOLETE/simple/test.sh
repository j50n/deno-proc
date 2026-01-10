#!/bin/bash
set -e

echo "Building and testing minimal WASM streaming example..."
./build.sh

echo ""
echo "Testing with sample input:"
echo "hello world" | deno run --allow-read run.ts
