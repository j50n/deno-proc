#!/bin/bash

set -e
set -x

# Update Rust and Cargo
rustup update 
cargo install mdbook mdbook-graphviz mdbook-pdf mdbook-epub

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE" && (
    # Generate API documentation from Deno
    echo "Generating API documentation..."
    deno doc --html --name="proc" --output=./site/src/api-docs ./mod.ts
)

cd "$HERE/site/" && (
    deno fmt **/*.md
    deno fmt **/*.ts

    mdbook build
    
    rm -rf ../docs/
    mkdir ../docs/
    rsync -av ./book/ ../docs/
)

cd "$HERE/wasm/docs/" && mdbook build
