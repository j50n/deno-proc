#!/bin/bash

set -e

HERE="$(realpath "$(dirname "$0")")"

deno install -rf --allow-read="$HERE/" --allow-write="$HERE/" --allow-net https://deno.land/x/udd/main.ts

#echo "{\"version\":\"`git describe --tags`\"}" > "$HERE/version.json"

cd "$HERE" && (
    udd `find . -type f -name "*.ts"`

    deno --unstable fmt `find . -type f -name "*.md"`
    deno --unstable fmt `find . -type f -name "*.ts"`

    # This detects the hack pattern, only on the second line of the file
    # and removes the added semicolon if present. `deno fmt` breaks the
    # hack shebang pattern, so we have to fix it up.
    sed -i '2s|^":";\s[/][/]#;|":" //#;|' `find . -type f -name "*.ts"`

    deno --unstable lint `find . -type f -name "*.ts"`
    deno --unstable check `find . -type f -name "*.ts"`

    deno --unstable test --trace-ops --reload --allow-read --allow-run=grep,sort,uniq,gunzip,ls,deno,cat,bash,wc,tr,head ./tests
)

