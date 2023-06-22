# proc

A better way to work with processes in Deno.

## The New Stuff

Documentation is at
[https://j50n.github.io/deno-proc/](https://j50n.github.io/deno-proc/).

To use:

```typescript
import * as proc from "http://deno.land/x/proc/mod3.ts";
```

This is now stable enough to use. It is moving toward the 1.0 release. Please
report any bugs you find.

## The Old Stuff

The documentation for the legacy library is available at
[Legacy Documentation](./legacy/README.md).

To use:

```typescript
import * as proc from "https://deno.land/x/proc/mod.ts";
```

The old version of this library was built on `Deno.run()` which is now
deprecated and scheduled to be removed in Deno 2.0.
