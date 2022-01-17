# deno-proc

My main motivation for writing `proc` is to allow me to replace my sketchy
`bash` scripts with Deno. I want `stdin` and `stdout` pipes, decent default
error handling, and minimal or no need to manually close things. Code written
using `proc` should be obvious and easy to read. I want the documentation to
cover both what can and can't be done like `bash`, with examples and recipes.

## documentation

```bash
deno doc -q https://deno.land/x/proc/mod.ts
```

## `stdout` from a process as lines

```ts
for await (const line of run({ cmd: ["ls", "-la"] }).stdoutLines()) {
  console.log(line);
}
```

## pipe `stdout` to `stdin`

```ts
const fileCount = await first(
  run({ cmd: ["ls", "-1"] })
    .pipe(run({ cmd: ["wc", "-l"] }))
    .stdoutLines(),
);

console.info(
  `Total number of files and folders in ${resolve(".")} is ${
    parseInt(fileCount!, 10)
  }.`,
);
```

## process `stderr` lines

I've implemented `.stderrLines()` to allow access to the standard error stream.
To gain access to this, you have to pass in `pipeStderr: true` when you create
the process.

I don't like this need for a-priori knowledge, and use of this is still more
awkward than I would like. I am putting it in because it solves the problem, but
expect API changes around this.
