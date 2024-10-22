# proc

Run child processes and work with IO in Deno using `AsyncIterables` that work
the way you expect them to.

Documentation:
[https://j50n.github.io/deno-proc/](https://j50n.github.io/deno-proc/).

To use:

```typescript
import * as proc from "http://deno.land/x/proc/mod.ts";

await proc.run("ls", "-la").toStdout();
```

The API is stabilizing and moving toward a 1.0 release. Documentation is a work
in progress.
