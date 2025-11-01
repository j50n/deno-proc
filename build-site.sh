#!/bin/bash

set -e
set -x

# Update Rust and Cargo
rustup update 
cargo install mdbook mdbook-graphviz

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE/site/" && (
    deno fmt **/*.md
    deno fmt **/*.ts

    mdbook build
    
    rm -rf ../docs/
    mkdir ../docs/
    rsync -av ./book/ ../docs/
)


