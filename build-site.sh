#!/bin/bash

set -e

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE/site/" && (
    deno fmt `find . -type f -name '*.md'`
    deno fmt `find . -type f -name '*.ts'`

    rustup self update
    rustup update 
    cargo install mdbook mdbook-graphviz 

    mdbook build
    
    rm -rf ../docs/
    mkdir ../docs/
    rsync -av ./book/ ../docs/
)


