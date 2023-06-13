# Maintenance

These are maintainers notes. "Forget-me-nots." Just ignore.

## Build

Format, lint, and run tests.

```sh
./build.sh
```

To build the legacy stuff.

```sh
cd ./legacy/ && ./build.ts
```

To build the new stuff and the legacy stuff together. Do this before a release.

```sh
./build-all.sh
```

## Build Site Docs

Source for the site is under `./site` and compiled to and distributed from
`./docs`.

```sh
./build-site.sh
```

This is separated so that I can isolate commits of `./docs/` builds from other
commits. `./site/src/` commits are okay to mix because those are source commits.
The `./docs/` commits are generated html, css, etc., and are quite messy next to
source commits.

> **WARN** This is not included in `build-all.sh`. _Separate `./build-site.sh`
> commits from other source commits._

## Dependency Maintenance

Integrated into the build.

## Release

This can be automated.

After committing the latest changes, create a tag.

```shell
git tag -a 0.0.0 -m "comment"
git push origin 0.0.0
```

Release it.

```shell
gh release create --generate-notes 0.0.0
```

If everything worked, the tag should be the latest at
[https://deno.land/x/proc](https://deno.land/x/proc).

Use `gh release create` rather than releasing manually. The release notes are
much better and more consistent as they are based on the actual commits.
