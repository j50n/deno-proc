#!/bin/bash

deno test --allow-read --allow-run=grep,sort,uniq,gunzip,ls,deno `find . -name '*.test.ts' | grep shell`