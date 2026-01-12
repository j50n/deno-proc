#!/bin/bash
set -e
odin build odin/add.odin -file -target:js_wasm32 -out:add.wasm -o:size
echo "Built add.wasm ($(du -h add.wasm | cut -f1))"
