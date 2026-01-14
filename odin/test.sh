#!/bin/bash
set -e

echo "Running Odin tests..."
odin test tests -out:test_runner
echo "Tests completed!"
