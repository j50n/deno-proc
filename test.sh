#!/bin/bash

deno test --allow-read --allow-run `find . -name '*.test.ts' | grep -P 'run\.test'`