# Maintenance

These are maintainers notes. "Forget-me-nots." Just ignore.

## Build

Format, lint, type-check, test, and benchmark.

```sh
./build.sh
```

It also updates the toolchain (`rustup update`, `cargo install mdbook`) and
every dependency to its latest version (`deno update --latest`). Dependencies in
`deno.json` are pinned exactly, so plain `deno update` never moves them.

The first project step rebuilds `wasm/flatdata.wasm` from `odin/src`, which
needs [Odin](https://odin-lang.org/) installed. The built `.wasm` is committed,
so without Odin, run the steps after `./odin/build.sh` by hand. Only a change
under `odin/src` needs the rebuild.

The library loads the module from `src/wasm/flatdata-wasm.ts`, which
`tools/embed-wasm.ts` generates from `wasm/flatdata.wasm`. `build.sh` runs it
after the Odin build; a test fails if the two differ.

## Release

proc is published to [JSR](https://jsr.io/@j50n/proc) as `@j50n/proc`. JSR takes
the version from `deno.json`, and the docs take it from the latest git tag, so
the two have to match and the tag has to exist before the docs are built.

1. Set `"version"` in `deno.json`, then commit and push.

2. Tag that commit and push the tag.

   ```sh
   git tag -a 0.0.0 -m "comment"
   git push origin 0.0.0
   ```

3. Publish. The first run prints a link to authorize in the browser.

   ```sh
   deno publish
   ```

4. Build the site docs (below), then commit and push them on their own.

5. Check the published package from a clean directory, since the tests run from
   local files and can't see packaging problems. Deno refuses versions under a
   day old unless told otherwise.

   ```sh
   cd "$(mktemp -d)" && deno eval --min-dep-age 0 '
     import { enumerate } from "jsr:@j50n/proc@0.0.0";
     import { fromCsvToRows, toTsv } from "jsr:@j50n/proc@0.0.0/transforms";
     const csv = new TextEncoder().encode("a,b\n");
     await enumerate([csv]).transform(fromCsvToRows()).flatten()
       .transform(toTsv()).toStdout();'
   ```

## Build Site Docs

Source for the site is under `./site` and compiled to and distributed from
`./docs`, which GitHub Pages serves from `main`.

```sh
./build-site.sh
```

`{{gitv}}` in the book becomes the latest git tag (`site/gitv.ts`), which is why
the docs are built after tagging.

This is separated so that I can isolate commits of `./docs/` builds from other
commits. `./site/src/` commits are okay to mix because those are source commits.
The `./docs/` commits are generated html, css, etc., and are quite messy next to
source commits.
