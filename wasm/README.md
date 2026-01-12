# Deno + Odin + WebAssembly

A complete guide to building WebAssembly modules with Odin and running them in
Deno/TypeScript.

The examples and documents in this subproject are unapologetically AI slop.
Actually, for the book, I have done some cursory cleanup in the first half of
the book, and the second half might be pure garbage. The point of this work was
to quickly iterate through a number of different designs until I both understood
the subject matter and had examples of design patterns that would suit what I
wanted to do. Done, and done. The book may be useful for anyone searching for
how to do WASM using Deno and Odin because, although the capability is robust,
the documentation you can find is often hidden in gists and git repos. It is
either not searchable or non-existant. In a matter of hours, I was able to go
through about five different ideas - some better than others - and finally get
to a point where I had something that is working and fully documented.

The point of this exercise wasn't to write a fabulous book. It was to write a
mediocre one, just good enough so that I could learn something. I will probably
tweak it as I experiment with things I don't quite understand, since it is a
good platform for experimentation. The docs will never be great. If someone
finds this useful, that is wonderful! It has already served my purpose.

WebAssembly has a lot of potential, and Odin makes it quite easy once you know
what you are doing.

## For AI Assistants

**Read `AI_GUIDE.md` instead of the book.** It contains everything you need in
~200 lines. The `docs/` folder contains a human-readable book that's too long
for efficient AI context usage.

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
