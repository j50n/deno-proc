#!/bin/bash

set -e

HERE="$(realpath "$(dirname "$0")")"

deno install -rf --allow-read="$HERE/" --allow-write="$HERE/" --allow-net https://deno.land/x/udd/main.ts

cd "$HERE/site/" && (
    rustup update && cargo install mdbook

    mdbook build
    rm -rf ../docs/*
    rsync -av ./book/ ../docs/
)

cd "$HERE" && (
    udd `find . -type f -name "*.ts"`

    deno fmt `find . -type f -name "*.md"`
    deno fmt `find . -type f -name "*.ts"`

    # This detects the hack pattern, only on the second line of the file
    # and removes the added semicolon if present. `deno fmt` breaks the
    # hack shebang pattern, so we have to fix it up.
    sed -i '2s|^":";\s[/][/]#;|":" //#;|' `find . -type f -name "*.ts"`

    deno lint `find . -type f -name "*.ts"`
    deno check `find . -type f -name "*.ts"`

    deno test --reload --allow-read --allow-run=grep,sort,uniq,gunzip,ls,deno,cat,bash,wc,tr,head ./tests
)

