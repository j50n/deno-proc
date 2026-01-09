#!/bin/bash

set -e
set -x

# Update Rust and Cargo
rustup update

# Update mdbook (only if newer version available)
cargo install mdbook

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE" && (
    # Build WASM module first
    echo "Building FlatText WASM module..."
    cd odin/flattext
    odin build main.odin -file -target:js_wasm32 -out:../../wasm/flattext.wasm -o:speed
    cd ../..
    echo "✅ Built wasm/flattext.wasm"

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

    deno test --reload --allow-read --allow-write=/tmp/ --allow-run=gzip,grep,sort,uniq,gunzip,ls,deno,cat,bash,wc,tr,head,echo,sh,false ./tests

    # Run performance benchmarks
    echo "Running performance benchmarks..."
    deno bench --allow-read --allow-write=/tmp/ --allow-run=gzip,grep,sort,uniq,gunzip,ls,deno,cat,bash,wc,tr,head,echo,sh,false ./tests/comprehensive_benchmarks.test.ts
)

