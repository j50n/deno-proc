# Running a Process

`proc` lets you run a process from Deno with as little boilerplate as possible.

```typescript
import { run } from "https://deno.land/x/proc@{{gitv}}/mod.ts";
```

To `ls -la`:

```typescript
await run("ls", "-la").toStdout();
```

To capture the lines as an array:

```typescript
const lines: string[] = await run("ls", "-la").lines.collect();
```

## Create a Command Programmatically

```typescript
import { Cmd, run } from "https://deno.land/x/proc@{{gitv}}/mod.ts";
```

A command requires that the first parameter be defined, and that it be either a
string or a URL. Additional parameters are string values. This doesn't quite fit
the signature of an array. Use
[Cmd](https://deno.land/x/proc@{{gitv}}/mod.ts?s=Cmd) as the type of the array.
This can be spread into `run`.

```typescript
// Assume options.all is a defined boolean.

const cmd: Cmd = ["ls"];
if (options.all) {
  ls.push("-la");
}

await run(...cmd).toStdout();
```

_The command array is type `Cmd`, not `string[]`. You need to declare this
explicitly._
