# proc

Introducing `proc`, a powerful functional extension for `AsyncIterable` in Deno.
`proc` supports managing external processes, provides extensions for concurrent
programming, and works seamlessly with `Deno` IO streams.

## The New Stuff

Documentation is at
[https://j50n.github.io/deno-proc/](https://j50n.github.io/deno-proc/).

To use the new library:

```typescript
import * as proc from "http://deno.land/x/proc/mod3.ts";
```

The new library is stabilizing and the code is working. New features and tests are
being added regularly. Changes to existing features are settling down. The
documentation is still a work in progress.

## The Old Stuff

The documentation for the legacy library is available at
[Legacy Documentation](./legacy/README.md).

TO use the old library:

```typescript
import * as proc from "https://deno.land/x/proc/mod.ts";
```

The old library was built on `Deno.run()` which is now deprecated and scheduled to
be removed in Deno 2.0. There were other reasons to start over from scratch, but
this was the primary reason everything changed.
