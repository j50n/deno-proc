# proc

Blue sky. Let's make something wonderful!

## A Warning

**The new API is in work and not yet ready (not even really close).** Big (good)
changes coming. Stay tuned.

## Documentation (Legacy API)

The documentation for the legacy API is available at
[Legacy Documentation](./legacy/README.md). It is recommended that you continue
to use the legacy API for the time being.

Note that only the legacy API is available from
`https://deno.land/x/proc/mod.ts`.

## Documentation (New API)

The documentation is available at
[https://j50n.github.io/deno-proc/](https://j50n.github.io/deno-proc/).

## A Big Change is Underway

> **Pardon our mess!** The deprecation of `Deno.run` is both a blessing and a
> curse. `Deno.Command` is a _great_ improvement ... and it breaks pretty much
> everything. I was going to have to redo the old library as it had gone in some
> wrong directions.
>
> - The old API will remain available, unchanged, until Deno 2.0 is released.
> - When Deno 2.0 is release, the `mod.ts` for the old library will be
  > relocated. Imports will have to change, but it will still work with Deno
  > 1.0.
> - The old API will **not** be upgraded to work with `Deno.Command`. Once
  > `Deno.run` is removed, the old API will no longer function.
>
> See [Legacy Documentation](./legacy/README.md) for the old documentation.

I am working on a new version of this library that makes common usage patterns
in `Deno.Command` much easier.

For now, this is a work in progress. Refer to the source code for the tests -
like [count-words.test](./tests/examples/count-words.test.md) - for examples
that are guaranteed to work with the current version.
