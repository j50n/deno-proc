_I am completely reworking this API. What is here works, mostly. It's useful.
The new API will address the issues I found while creating this one. It is a lot
more ambitious in scope. I will release something as soon as it feels like it is
starting to gel. Checkout feature branch 9 for progress._

# deno-proc

Abstractions for running processes in Deno.

This is still very early. Things are going to change. A lot. Functionality is
limited. The API is unstable.

Deno has all the right parts for working with processes, but I really want
something that is a better version of what I get in `bash` scripts. I want
`stdin` and `stdout` pipes, decent default error handling, and minimal need to
manually close things. I want all this to work with a fluent API.

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
