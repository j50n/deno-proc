# Building and releasing

Two scripts at the repository root do the building: `build.sh` checks and tests
the library, and `build-site.sh` builds this book into `docs/`. The release
itself is a short manual process, written down in
[MAINT.md](https://github.com/j50n/deno-proc/blob/main/MAINT.md).

## `build.sh`

In order, it:

1. Updates the toolchain: `rustup update`, then `cargo install mdbook`.
2. Rebuilds the WebAssembly module with `./odin/build.sh`, and embeds it with
   `tools/embed-wasm.ts` (below).
3. Updates every dependency to its latest version with `deno update --latest`.
   The versions in `deno.json` are pinned exactly, so this is the only thing
   that moves them; review the diff.
4. Formats the Markdown and TypeScript with `deno fmt`.
5. Runs `deno lint` and `deno check` on the TypeScript.
6. Runs the tests (`./tests` and `./labs/wasm`) with `--allow-run` limited to
   the commands they use, and then the benchmarks in
   `tests/comprehensive_benchmarks.test.ts`.

It stops at the first failure (`set -e`).

## The WebAssembly module

The CSV parser and the CSV, TSV, and record writers run in WebAssembly built
from Odin source in `odin/src/`. `odin/build.sh` runs the Odin CSV tests,
compiles the module, and copies it to `wasm/flatdata.wasm`.
`tools/embed-wasm.ts` then writes that file, base64-encoded, into
`src/wasm/flatdata-wasm.ts`, which is what the library loads: a package
installed from JSR has `https:` module URLs and can't read a `.wasm` file next
to it.

Both the `.wasm` and the generated `.ts` are committed, so Odin is needed only
when something under `odin/src/` changes. Without it, `build.sh` fails at step
2; run the steps after it by hand. If the two files ever disagree,
`tests/packaging.test.ts` fails and says to run `tools/embed-wasm.ts`.

## `build-site.sh`

1. Updates `rustup` and mdBook, as `build.sh` does.
2. Generates the HTML API docs with `deno doc --html` into `site/src/api-docs/`.
3. Formats the book's Markdown and TypeScript.
4. Builds the book with `mdbook build`, using `site/book.toml`. Two
   preprocessors run: `site/gitv.ts` fills in the version placeholder (`gitv` in
   double braces) with the latest git tag, and
   `tools/mdbook-deno-script-preprocessor.ts` runs `<script>` blocks in pages
   (see its `.md` file).
5. Replaces `docs/` with the built site. GitHub Pages serves `docs/` from
   `main`.
6. Writes `llms.txt` (an index of the pages) and `llms-full.txt` (the whole
   book, examples and output included) into `docs/` with `tools/llms-txt.ts`,
   for LLMs, which read those more reliably than HTML.

Because the version shown in the book comes from the latest tag, build the site
after tagging a release, not before. Commit `docs/` on its own: the generated
files make a noisy diff that shouldn't hide source changes.

## Releasing

[MAINT.md](https://github.com/j50n/deno-proc/blob/main/MAINT.md) has the
commands. In outline: set the version in `deno.json` (JSR takes it from there),
commit, tag that commit with the same version and push the tag, run
`deno publish`, build and commit the site, and finally import the new version in
a clean directory to check the published package, since the tests only ever see
local files.
