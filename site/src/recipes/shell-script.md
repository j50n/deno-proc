# Replacing a shell script

The task: a nightly bash script that writes a manifest of the day's CSV exports
(rows, refunds, a checksum) and then compresses them. Here it is:

```bash
{{#include ../../examples/fixtures/recipes-manifest.sh}}
```

And the same script with proc:

```typescript
{{#include ../../examples/recipes/shell-script.ts}}
```

```text
{{#include ../../examples/recipes/shell-script.out}}
```

Run it with only what it touches:

```sh
deno run --allow-read=recipes-exports,manifest.txt --allow-write=manifest.txt \
  --allow-run=sha256sum,cut,gzip manifest.ts
```

## What maps to what

| bash                 | proc                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `set -e`             | always on: a failed command throws from the `await` that reads it |
| `set -o pipefail`    | always on: every command in a `.run()` chain is checked           |
| `a \| b`             | `run("a").run("b")`                                               |
| `x=$(cmd)`           | `await text(run("cmd"))`, with the helper above                   |
| `for f in dir/*.csv` | `Deno.readDir`, filter, sort                                      |
| `"$f"`               | `f`: each argument is its own string, so nothing needs quoting    |
| `cmd \|\| true`      | `try`/`catch`, or an `fnError` handler                            |
| `cat file`           | `await read("file").toStdout()`                                   |
| `> file`             | `Deno.writeTextFile`, or `.transform(toBytes).writeTo("file")`    |
| `cd dir && cmd`      | `run({ cwd: "dir" }, "cmd")`                                      |
| `VAR=x cmd`          | `run({ env: { VAR: "x" } }, "cmd")`                               |
| `cmd 2>/dev/null`    | `run({ fnStderr: (s) => s.forEach(() => {}) }, "cmd")`            |
| `exit 1`             | `Deno.exitCode = 1`, or `Deno.exit(1)`                            |

Some steps are simpler in TypeScript than as a command. `tail -n +2 | wc -l`
became `read(f).lines.drop(1).count()`, and the refund count became a `count()`
with a test, which removed the bash script's most fragile line: `grep -c` exits
with code 1 when it counts zero, so under `set -e` it needs `|| true`, and
forgetting that kills the script on the first file with no refunds. When you do
keep `grep`, [Searching logs](./logs.md#letting-grep-do-the-searching) shows how
to let "no match" through.

## When a command fails

Nothing catches errors in the script, so a failure ends it the way `set -e`
does, with exit code 1. The difference is what you see. If `sha256sum` can't
read a file:

```text
sha256sum: missing.csv: No such file or directory
error: Uncaught (in promise) UpstreamError: exit code: 1
    ...
Caused by: ExitCodeError: exit code: 1
```

The first line is `sha256sum`'s own stderr, which goes to your terminal as it
would from bash. `cut` succeeded, so the error at the end is an `UpstreamError`
from `cut`, and its `cause` is the `ExitCodeError` of the command that failed.
To handle failures rather than stop, put a `try` around the `await`; see
[Errors](../processes/errors.md).

## Traps when translating

- **A command you don't consume isn't checked.** `run("gzip", f)` on its own
  starts gzip, and your script waits for it to exit, but nothing reads its exit
  code, so a failure passes silently. Always `await` a consumer:
  `await run("gzip", f).collect()`.
- **`.lines.first` is not `$(...)`.** It stops reading after one line, and
  stopping early skips the exit-code check, so a command that prints a line and
  then fails gives you the line and no error. Collect the output, as `text()`
  does, when the exit code matters.
- **There is no glob expansion.** `run("ls", "*.csv")` passes the text `*.csv`
  to `ls`, which fails because no file has that name. List the files in
  TypeScript, or run a real shell for the parts that need one:
  `run("sh", "-c", "ls *.csv")`. Never build a `sh -c` string from data you
  didn't write; that is where quoting bugs and injection come from.
- **`Deno.readDir` is unsorted.** A glob is sorted by name; sort the list
  yourself if order matters.
