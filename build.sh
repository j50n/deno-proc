#!/bin/bash

set -e
set -x

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE" && (
    # Update Deno
    deno update --latest

    # Update Rust and Cargo
    rustup update

    # Update mdbook (only if newer version available)
    cargo install mdbook

    deno fmt **/*.md
    deno fmt **/*.ts

    # This detects the hack pattern, only on the second line of the file
    # and removes the added semicolon if present. `deno fmt` breaks the
    # hack shebang pattern, so we have to fix it up.
    sed -i '2s|^":";\s[/][/]#;|":" //#;|' **/*.ts

    deno lint **/*.ts
    deno check **/*.ts

    deno test --reload --allow-read --allow-write=/tmp/ --allow-run=gzip,grep,sort,uniq,gunzip,ls,deno,cat,bash,wc,tr,head,echo,sh ./tests
)

