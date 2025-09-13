#!/bin/bash

set -e
set -x

HERE="$(realpath "$(dirname "$0")")"

cd "$HERE" && (
    deno update --latest

    deno fmt `find . -type f -name "*.md"`
    deno fmt `find . -type f -name "*.ts"`

    # This detects the hack pattern, only on the second line of the file
    # and removes the added semicolon if present. `deno fmt` breaks the
    # hack shebang pattern, so we have to fix it up.
    sed -i '2s|^":";\s[/][/]#;|":" //#;|' `find . -type f -name "*.ts"`

    deno lint `find . -type f -name "*.ts"`
    deno check `find . -type f -name "*.ts"`

    deno test --reload --allow-read --allow-write=/tmp/ --allow-run=gzip,grep,sort,uniq,gunzip,ls,deno,cat,bash,wc,tr,head ./tests
)

