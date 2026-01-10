# Deno + Odin + WebAssembly

A complete guide to building WebAssembly modules with Odin and running them in Deno/TypeScript.

## For AI Assistants

**Read `AI_GUIDE.md` instead of the book.** It contains everything you need in ~200 lines. The `docs/` folder contains a human-readable book that's too long for efficient AI context usage.

Working example: `examples/foundation/`

## For Humans

The full book is in `docs/` - build with `mdbook build`.

## Quick Start

```bash
# Build WASM
odin build src.odin -file -target:js_wasm32 -out:module.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

# Run with Deno
deno run --allow-read main.ts
```

## Project Structure

```
wasm/
├── AI_GUIDE.md              # AI-focused quick reference
├── docs/                    # Human-readable mdbook
│   └── src/                 # Book source
└── examples/
    └── foundation/          # Complete working example
        ├── odin/            # Odin source files
        ├── demo.wasm        # Compiled WASM
        ├── odin-runtime.ts  # Runtime bridge
        ├── demo.ts          # TypeScript wrapper
        └── build.sh         # Build script
```
