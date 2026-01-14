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

    deno fmt **/*.md
    deno fmt **/*.ts

    # This detects the hack pattern, only on the second line of the file
    # and removes the added semicolon if present. `deno fmt` breaks the
    # hack shebang pattern, so we have to fix it up.
    sed -i '2s|^":";\s[/][/]#;|":" //#;|' **/*.ts

    deno lint **/*.ts
    deno check **/*.ts

    deno test --reload --allow-read --allow-write=/tmp/ --allow-run=cat,deno,echo,false,grep,gunzip,gzip,ls,printf,sh,sort,tr,uniq,wc ./tests

    # Run performance benchmarks
    echo "Running performance benchmarks..."
    deno bench --allow-read --allow-write=/tmp/ --allow-run=cat,echo,false,grep,gunzip,gzip,ls,printf,sh,sort,tr,uniq,wc ./tests/comprehensive_benchmarks.test.ts
)

