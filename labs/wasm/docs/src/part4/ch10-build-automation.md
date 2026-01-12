# Build Automation

Manual builds get old fast. A good build script catches errors early, runs tests automatically, and produces consistent output.

## A Complete Build Script

Here's a production-ready `build.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Building demo.wasm..."
odin build odin/ \
    -target:js_wasm32 \
    -out:demo.wasm \
    -o:speed \
    -extra-linker-flags:"--import-memory --strip-all"

echo "✅ Build: demo.wasm ($(du -h demo.wasm | cut -f1))"

echo "🎨 Formatting..."
deno fmt --check *.ts || deno fmt *.ts

echo "🔍 Linting..."
deno lint *.ts
deno check *.ts

echo "🧪 Testing..."
deno test --allow-read

echo "🎉 All checks passed!"
```

## Odin Compilation Flags

```bash
odin build odin/ \
    -target:js_wasm32 \
    -out:demo.wasm \
    -o:speed \
    -extra-linker-flags:"--import-memory --strip-all"
```

Key flags:
- `--import-memory` — JavaScript creates memory, passes to WASM
- `--strip-all` — Remove debug symbols (~50% size reduction)

Optimization options:
- `-o:none` — Fast compile, no optimization
- `-o:size` — Optimize for small output
- `-o:speed` — Optimize for performance

## Watch Mode

Rebuild on file changes:

```bash
deno test --allow-read --watch
```

Or with inotifywait:

```bash
while true; do
    ./build.sh
    inotifywait -q -e modify odin/*.odin *.ts
done
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build and Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v1
      - name: Install Odin
        run: |
          wget https://github.com/odin-lang/Odin/releases/latest/download/odin-ubuntu-latest.zip
          unzip odin-ubuntu-latest.zip
          echo "$PWD/odin" >> $GITHUB_PATH
      - run: ./build.sh
```

## Build Variants

```bash
FLAGS='-extra-linker-flags:"--import-memory --strip-all"'
case "$1" in
  dev)     odin build odin/ -target:js_wasm32 -out:demo.wasm -o:none $FLAGS ;;
  release) odin build odin/ -target:js_wasm32 -out:demo.wasm -o:speed $FLAGS ;;
  size)    odin build odin/ -target:js_wasm32 -out:demo.wasm -o:size $FLAGS ;;
esac
```

Good build automation is invisible when it works and invaluable when something breaks.
