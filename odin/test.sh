#!/bin/bash
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"

echo "Running Odin tests..."
odin test "$HERE/tests" -out:"$HERE/test_runner"
echo "Tests completed!"
