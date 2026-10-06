# Install and run a first script

Add proc to your project:

```sh
deno add jsr:@j50n/proc
```

This records the package in `deno.json`, and from then on you import it by name.
The core library is `@j50n/proc`; the data transforms (CSV, TSV, JSON lines) are
a separate entry point, `@j50n/proc/transforms`, so you load them only if you
use them.

```typescript
import { enumerate, read, run } from "@j50n/proc";
import { fromCsvToRows, toTsv } from "@j50n/proc/transforms";
```

For a one-off script without a `deno.json`, import from JSR directly:
`import { run } from "jsr:@j50n/proc@{{gitv}}";`.

## A first script

Save this as `errors.ts`, next to a log file called `app.log`:

```typescript
{{#include ../../examples/start/first-script.ts}}
```

Run it, allowing it to start `grep`:

```sh
deno run --allow-run=grep errors.ts
```

```text
{{#include ../../examples/start/first-script.out}}
```

If `app.log` has no errors, `grep` exits with code 1, and the script stops with
an `ExitCodeError`. That is proc treating a failed command as an error, the way
`set -e` does in bash. [Errors](../processes/errors.md) shows how to handle it.

## Permissions

Deno asks before a script runs a program or touches a file. Grant only what the
script needs:

| The script                        | Needs                                     |
| --------------------------------- | ----------------------------------------- |
| runs commands with `run()`        | `--allow-run`, or `--allow-run=git,grep`  |
| reads files with `read()`         | `--allow-read`, or `--allow-read=./logs`  |
| writes files with `writeTo()`     | `--allow-write`, or `--allow-write=./out` |
| uses only `enumerate()` and steps | nothing                                   |

A child inherits your environment. Passing `env` to `run()` adds or overrides
variables for the child, and doesn't need `--allow-env`.
