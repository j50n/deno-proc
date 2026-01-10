# Getting Started

WebAssembly lets you run compiled code in JavaScript environments. You know this. What you need to know is how to actually use it with Deno and Odin.

## Why Odin?

You could write WebAssembly in Rust, C, C++, or Go. We're using Odin because:

- **Clean syntax** — Reads like pseudocode. No fighting the language.
- **Explicit control** — Manual memory management without the pain.
- **First-class WASM support** — Compiles to WASM without ceremony.
- **Small output** — Odin WASM modules are tiny compared to alternatives.

Here's a taste:

```odin
calculate_area :: proc(radius: f64) -> f64 {
    return 3.14159 * radius * radius
}
```

If you can read that, you can read Odin.

## Build Target

Odin supports several WebAssembly targets:

| Target | Runtime | Use Case |
|--------|---------|----------|
| `js_wasm32` | Full | JavaScript host with `odin_env` imports |
| `js_wasm64p32` | Full | 64-bit WASM with 32-bit pointers for JS |
| `wasi_wasm32` | Full | WASI-compatible runtimes (Wasmtime, etc.) |
| `wasi_wasm64p32` | Full | 64-bit WASI with 32-bit pointers |
| `freestanding_wasm32` | None | Bare metal, no runtime, tiny output |
| `freestanding_wasm64p32` | None | 64-bit bare metal |

**This book uses `js_wasm32` exclusively.** It provides the full standard library (`fmt`, `core:math`, allocators) and targets JavaScript/Deno hosts.

Why not `freestanding_wasm32`? It produces tiny binaries but lobotomizes Odin—no `fmt`, no allocators, no standard library. You're left reimplementing basics. The ~30KB overhead of `js_wasm32` loads in under 0.1ms (see [Performance](../part4/ch11-performance.md)). You won't notice it, and you get all of Odin.

> ⚠️ **Avoid WASI targets with Deno.** Deno's WASI support is incomplete and poorly documented. The `wasi_wasm32` target looks appealing but leads to hours of frustration. Stick with `js_wasm32`.

```bash
odin build . -target:js_wasm32 -out:module.wasm \
    -extra-linker-flags:"--import-memory --strip-all"
```

Output is typically ~30-40KB for simple modules. The runtime requires `odin_env` imports that your JavaScript host must implement (covered in Part 2).

## Project Structure

```
foundation/
├── odin/
│   └── demo.odin    # Odin source
├── demo.ts          # TypeScript wrapper
├── demo.test.ts     # Tests
├── demo.wasm        # Compiled output
├── build.sh              # Build script
└── deno.json             # Deno config
```

## Build Script

Create `build.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Building demo.wasm..."
odin build odin/ \
    -target:js_wasm32 \
    -out:demo.wasm \
    -extra-linker-flags:"--import-memory --strip-all"

echo "✅ Build: demo.wasm ($(du -h demo.wasm | cut -f1))"
```

Key flags:
- `--import-memory`: Let JavaScript create and manage memory (avoids chicken-and-egg problem)
- `--strip-all`: Remove debug symbols for smaller output (~50% size reduction)

## Deno Configuration

Create `deno.json`:

```json
{
  "imports": {
    "@std/assert": "jsr:@std/assert@1"
  }
}
```

## Verify Your Setup

Create `odin/demo.odin`:

```odin
package main

@(export)
add :: proc "c" (a: i32, b: i32) -> i32 {
    return a + b
}
```

Build it:

```bash
chmod +x build.sh
./build.sh
```

If you see the success message and a `.wasm` file appears, you're ready.
