## Build

Format, lint, and run tests.

```sh
./build.sh
```

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
