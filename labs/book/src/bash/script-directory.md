# Getting Script Directory

A reliable way to get the absolute path of a script's directory, regardless of where it's called from.

## The Pattern

```bash
HERE="$(cd "$(dirname "$0")" && pwd)"
```

## How It Works

1. `dirname "$0"` - Gets the directory part of the script path
2. `cd "$(dirname "$0")"` - Changes to that directory
3. `&& pwd` - If cd succeeds, prints the current working directory
4. `$(...)` - Captures the output into the `HERE` variable

The key insight: the `cd` happens in a subshell created by `$()`, so it doesn't affect your current working directory. You get the absolute path without side effects.

## Example Usage

```bash
#!/bin/bash
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"

echo "Running tests from: $HERE"
odin test "$HERE/tests" -out:"$HERE/test_runner"
```

Now the script works correctly whether you run it as:
- `./test.sh` (from the script's directory)
- `../odin/test.sh` (from a parent directory)
- `/absolute/path/to/test.sh` (with an absolute path)

## Why Not `realpath`?

The `cd && pwd` pattern is more portable than `realpath`:
- `realpath` isn't available on all systems (especially older macOS)
- `pwd` after `cd` is POSIX standard and works everywhere
- It properly resolves symlinks and relative paths

This is the idiomatic bash way to solve this problem.
