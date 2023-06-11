#!/bin/bash

set -e

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE/site/" && (
    rustup self update
    rustup update 
    cargo install mdbook
    cargo install mdbook-graphviz 

    mdbook build
    rm -rf ../docs/*
    rsync -av ./book/ ../docs/
)


