#!/bin/bash

cd ./tests/ && (
    deno fmt
    deno test --allow-read --allow-run `find ./runnable/ -name '*.test.ts'`
)