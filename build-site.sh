#!/bin/bash

set -e
set -x

# Update Rust and Cargo
rustup update 
cargo install mdbook

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE" && (
    # Generate API documentation from Deno
    echo "Generating API documentation..."
    deno doc --html --name="proc" --output=./site/src/api-docs ./mod.ts ./src/transforms/mod.ts
)

cd "$HERE/site/" && (
    deno fmt **/*.md
    deno fmt **/*.ts

    mdbook build
    
    rm -rf ../docs/
    mkdir ../docs/
    rsync -av ./book/ ../docs/
)

cd "$HERE" && (
    # The book for LLMs: an index, and everything in one Markdown file.
    deno run --allow-read --allow-write --allow-run=git \
        tools/llms-txt.ts site/src docs
)
