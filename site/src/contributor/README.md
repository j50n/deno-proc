# Contributing

These pages are for working on proc itself: where the code is, how it fits
together, how it is tested, and how a release goes out. To use proc, start at
[Install and run a first script](../start/install.md) instead.

## What's where

| Path                    | What it holds                                                          |
| ----------------------- | ---------------------------------------------------------------------- |
| `mod.ts`                | the `@j50n/proc` entry point; its module comment is the JSR front page |
| `src/`                  | the library; see [Architecture](./architecture.md)                     |
| `src/transforms/mod.ts` | the `@j50n/proc/transforms` entry point (CSV, TSV, JSON lines, ...)    |
| `scripts/flatdata/`     | the `flatdata` CLI, exported as `@j50n/proc/flatdata`                  |
| `swift/`                | the Embedded Swift source of the WebAssembly CSV and TSV module        |
| `wasm/flatdata.wasm`    | the built module, committed so that Swift is needed only to change it  |
| `tests/`                | the tests; see [Testing](./testing.md)                                 |
| `site/src/`             | this book (mdBook), and `site/examples/`, the code it shows            |
| `docs/`                 | the built site, committed; GitHub Pages serves it from `main`          |
| `tools/`                | build helpers: WASM embedding, the book's example runner, `llms.txt`   |
| `benchmarks/`           | performance studies; nothing in the library uses them                  |

`deno publish` sends JSR every file that `.gitignore` and the `"publish"`
`"exclude"` list in `deno.json` don't leave out: meant to be `mod.ts`, `src/`,
`scripts/flatdata/`, the README, and the license. A stray file or directory in
the working tree goes too, so check `deno publish --dry-run` before a release.

## Getting set up

You need [Deno](https://deno.com). That is enough to change the TypeScript, run
the tests, and type-check everything. Two more tools are needed only for some
jobs:

- [Swift](https://www.swift.org/) 6.3.2 with its Embedded WebAssembly SDK
  (`swift-6.3.2-RELEASE_wasm-embedded`), to rebuild the WebAssembly module after
  a change under `swift/`.
- [mdBook](https://rust-lang.github.io/mdBook/) (installed with Rust's `cargo`),
  to build the site.

The day-to-day loop, from the repository root:

```sh
deno fmt
deno lint
deno check mod.ts src/transforms/mod.ts
deno test --allow-read --allow-write=/tmp/ --allow-run ./tests
```

`./build.sh` does all of that and more (it also rebuilds the WASM and updates
the toolchain and dependencies); [Building and releasing](./build-process.md)
says what each script does.

## Pages in this section

- [Architecture](./architecture.md): the modules, and how a pipeline, its
  errors, and shutdown work inside.
- [Coding standards](./coding-standards.md): the conventions the code and the
  public API follow.
- [Documentation guidelines](./documentation.md): who the docs are for, and how
  doc comments and book pages are written.
- [Testing](./testing.md): the test suites, including the one that runs every
  example in this book.
- [Building and releasing](./build-process.md): the build scripts, the WASM
  build, and the release.
- [The CSV reader](./csv-parser.md): what the WebAssembly module reads, how, and
  how it is tested.

Bugs and questions go to
[GitHub issues](https://github.com/j50n/deno-proc/issues).
