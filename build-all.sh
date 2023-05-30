#!/bin/bash

HERE="$(realpath "$(dirname "$0")")"

deno install -rf --allow-read="$HERE/" --allow-write="$HERE/" --allow-net https://deno.land/x/udd/main.ts

cd "$HERE/legacy/" && (
    ./build.ts
)

cd "$HERE/" && (
    ./build.sh
)