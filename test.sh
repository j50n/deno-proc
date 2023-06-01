#!/bin/bash

deno test --allow-read --allow-run=grep,sort,uniq,gunzip,ls,deno,cat,bash `find . -name '*.test.ts' | grep shell`