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

## Build Targets

Odin compiles to WebAssembly using different targets. Your choice matters.

### freestanding_wasm32

Minimal WASM modules. No runtime, no standard library, just your code.

```bash
odin build . -target:freestanding_wasm32
```

Output is tiny—often just a few kilobytes. But you're on your own: no `print`, no memory allocation, no math functions unless you provide them from JavaScript.

Use when bundle size is critical or you need maximum control.

### js_wasm32

Includes Odin's runtime and standard library access.

```bash
odin build . -target:js_wasm32
```

Output is larger (~30-40KB) but you get `fmt.println`, dynamic allocation with `make`/`delete`, and the full `core:math` package.

Use when you need standard library features or development speed matters more than bundle size.

We'll use `js_wasm32` throughout this book—it demonstrates more concepts and the patterns apply to both targets.

## Project Structure

```
foundation/
├── odin/
│   └── math_demo.odin    # Odin source
├── math-demo.ts          # TypeScript wrapper
├── math-demo.test.ts     # Tests
├── math-demo.wasm        # Compiled output
├── build.sh              # Build script
└── deno.json             # Deno config
```

## Build Script

Create `build.sh`:

```bash
#!/bin/bash
set -e

echo "🔨 Building math_demo.wasm..."
odin build odin/ \
    -target:js_wasm32 \
    -out:math-demo.wasm \
    -o:speed

echo "✅ Build: math-demo.wasm ($(du -h math-demo.wasm | cut -f1))"
```

The `-o:speed` flag optimizes for performance. Use `-o:size` for smaller output, `-o:none` for faster compilation during development.

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

Create `odin/math_demo.odin`:

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
