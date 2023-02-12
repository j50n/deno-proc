## Build

Format, lint, and run tests.

```sh
./build
```

## Dependency Maintenance

See [udd](https://github.com/hayd/deno-udd) for installation instructions.

To update all files:

```sh
udd `find . -name '*.ts'`
```

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

If everything worked, the tag should be the latest at [https://deno.land/x/proc](https://deno.land/x/proc).