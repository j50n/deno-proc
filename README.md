# proc

A better way to work with processes in Deno.

## The New Stuff

Documentation:
[https://j50n.github.io/deno-proc/](https://j50n.github.io/deno-proc/).

To use:

```typescript
import * as proc from "http://deno.land/x/proc/mod.ts";
```

The API is stabilizing and moving toward a 1.0 release. Documentation is a work
in progress.

Please report any bugs you find.

## The Old Stuff

Documentation: [Legacy Documentation](./legacy/README.md).

To use:

```typescript
import * as proc from "https://deno.land/x/proc/mod1.ts";
```

The old version of this library was built on `Deno.run()` which is now
deprecated and scheduled to be removed in Deno 2.0.
