#!/bin/bash

set -e
set -x

# Update Rust and Cargo
rustup update

# Update mdbook (only if newer version available)
cargo install mdbook

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE" && (
    # Build WASM module
    ./odin/build.sh

    # Update Deno
    deno update --latest

    TS_FILES="benchmarks/*.ts dev/*.ts scripts/*/*.ts site/*.ts src/*.ts tests/*.ts tools/*.ts"

    deno fmt **/*.md
    deno fmt $TS_FILES

    # This detects the hack pattern, only on the second line of the file
    # and removes the added semicolon if present. `deno fmt` breaks the
    # hack shebang pattern, so we have to fix it up.
    sed -i '2s|^":";\s[/][/]#;|":" //#;|' $TS_FILES

    deno lint $TS_FILES
    deno check $TS_FILES

    deno test --reload --allow-read --allow-write=/tmp/ --allow-run=cat,deno,echo,false,git,grep,gunzip,gzip,ls,printf,sh,sort,tr,uniq,wc ./tests

    # Run performance benchmarks
    echo "Running performance benchmarks..."
    deno bench --allow-read --allow-write=/tmp/ --allow-run=cat,echo,false,grep,gunzip,gzip,ls,printf,sh,sort,tr,uniq,wc ./tests/comprehensive_benchmarks.test.ts
)

