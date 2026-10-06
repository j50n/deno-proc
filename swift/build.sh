#!/bin/bash
# Build the CSV/TSV WebAssembly module and copy it to wasm/flatdata.wasm.
# Then run tools/embed-wasm.ts to embed it in the library (../build.sh does
# both).
set -e

cd "$(dirname "$0")"

swift build --swift-sdk "${SWIFT_SDK:-swift-6.3.2-RELEASE_wasm-embedded}" -c release

cp .build/wasm32-unknown-wasip1/release/CSV.wasm ../wasm/flatdata.wasm
ls -l ../wasm/flatdata.wasm
