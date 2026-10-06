# Testing

Everything in `tests/` runs with one command from the repository root:

```sh
deno test --allow-read --allow-write=/tmp/ --allow-run ./tests
```

It takes under a minute. `build.sh` runs the same tests with `--allow-run`
narrowed to the commands they use. The tests run real commands (`sh`, `cat`,
`grep`, `sort`, `gzip`, `git`, ...), so they expect a Unix system with the usual
tools.

## What's where

| Path                                                            | What it tests                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tests/command/`                                                | `Process`, `main()`, `terminateAll()`; each shutdown test runs its own Deno process         |
| `tests/enumerable/`                                             | `Enumerable`: streaming, `take`/`drop`, `zip`, `concat`, stderr handling                    |
| `tests/errors/`                                                 | how errors pass through pipelines and handlers                                              |
| `tests/docs/`                                                   | the behavior the doc comments describe, a file per module                                   |
| `tests/transforms/`                                             | each data format, `LazyRow`, and the WASM module against a TypeScript reference             |
| `tests/flatdata/`, `tests/flatdata*.test.ts`                    | the `flatdata` CLI                                                                          |
| `tests/regressions/`                                            | tests for bugs that were found and fixed                                                    |
| `tests/book_examples.test.ts`                                   | every example in this book (below)                                                          |
| `tests/readme_examples.test.ts`                                 | the README's examples                                                                       |
| `tests/packaging.test.ts`                                       | the embedded WASM matches `wasm/flatdata.wasm`; every documented import names a real export |
| `tests/*_benchmarks.test.ts`, `tests/overhead_analysis.test.ts` | benchmarks, for `deno bench`; `deno test` skips them                                        |

`tests/mdbook_examples.test.ts` and `tests/tutorial.test.ts` test examples from
the previous edition of the book. `tutorial.test.ts` reads this repository's git
history, so it needs a clone, not a source download.

Name a test for the claim it proves, as a sentence:
`"take(n) ends after the nth item, without waiting for another."` A failing test
then says what broke. For a bug, write the test first and watch it fail.

## The book's examples

Every code block in this book that runs is a file under `site/examples/`, pulled
into its page with `{{#include}}`. `tests/book_examples.test.ts` does two things
with them:

1. Type-checks all of them at once, in strict mode, against the repository's
   `deno.json`, so `"@j50n/proc"` resolves to the local code.
2. Runs each one in a fresh temporary directory holding a copy of
   `site/examples/fixtures/`, and compares what it prints on stdout with the
   `.out` file beside it, which the page also shows. An example without a `.out`
   file only has to exit 0.

So a page can't show output the code doesn't produce, and a change to the
library that alters an example's behavior fails the test.

To write or change an example, run it the same way the test does:

```sh
deno run -A tools/book-example.ts site/examples/recipes/logs-search.ts
```

Read what it prints. When it is what the page should show, save it as the `.out`
file:

```sh
deno run -A tools/book-example.ts --save site/examples/recipes/logs-search.ts
```

The rules that keep these tests reliable:

- **Deterministic output.** No times, PIDs, absolute paths, random numbers, or
  results in completion order (sort them first).
- **No network.** Use local commands and files in `fixtures/`.
- **Fixtures are shared.** Every example sees every fixture. Name a new one
  after its section (`recipes-exports/`, `data-sales.csv`), and don't change one
  another page relies on.
- **Narrow before use in a `catch`** (`if (error instanceof ExitCodeError)`),
  since the examples are type-checked strictly.

A fragment that can't run, such as a deliberate mistake or code that would hang,
stays inline in the Markdown, and the prose says it is a fragment.

## Doc comment examples

The `@example` blocks in `src/` are what JSR and editors show. They aren't run
(many touch files or the network), but they must type-check:

```sh
deno check --doc-only mod.ts src/
```

## The WASM module

The module is tested from TypeScript, through the committed build, so the tests
run without Swift installed. `tests/transforms/reference.ts` is an independent
TypeScript CSV and TSV reader and writer, and `readers.test.ts` and
`convert.test.ts` compare the module with it on edge cases at many chunk sizes,
plus fields of several megabytes. [The CSV reader](./csv-parser.md#tests) says
more.

## Benchmarks

```sh
deno bench --allow-read --allow-write=/tmp/ --allow-run ./tests/comprehensive_benchmarks.test.ts
```

`build.sh` runs this one. The other benchmark files, and the studies in
`benchmarks/`, are run by hand when performance is the question.
