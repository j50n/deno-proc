#!/bin/bash

deno test --allow-read --allow-run `find ./tests/ -name '*.test.ts'`