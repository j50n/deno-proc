# Introduction

Deno is a great choice to replace your `bash` scripts when they become too complex. Type checking and security-by-default make it safer to use when you have to test in production. It removes the need for a package-manager, so you can run scripts from source without an installation step. If only we had better support for running child processes.

At the start of 2023, we got that support. The Deno team has deprecated `Deno.run` in favor of `Deno.Command`. The new API is a major step forward. Resource cleanup and error checking are automatic now. The resulting code is cleaner. The performance is stellar. I think, though, that there is some room for improvement.  

Introducing `proc`. This is is a lightweight rethinking of the `Deno.Command` API for use when you are doing shell-script-like things. It makes the simple things dead-simple and really cleans up the more complex things. While the resulting code isn't as terse as the equivalent shell script, it is pretty close to minimal for Typescript syntax. 

Note that `proc` is not reinventing or replacing `Deno.Command` at all. It is just a small  extension. It uses the same interfaces, the same methods, streams, etc., so you can do things the same way you would - with the same performance - as `Deno.Command`. You can use as much or as little of `proc` as you wish.

Here are some working examples to give you an idea of some of the differences between `proc` and out-of-the-box `Deno.Command`.

## The `Deno.Command` Way

Here are some different approaches to listing files using `ls` using
`Deno.Command`. The equivalent in `bash` would look like this:

```shell
ls -la
```

To do this using `Deno.Command`, I can do this (all output at once):

```typescript
const output = await new Deno.Command("ls", { args: ["-la"] }).output();
console.log(new TextDecoder().decode(output.stdout));
```

Or this (output is streamed as text lines):

```typescript
for await (
  const line of new Deno.Command("ls", { args: ["-la"], stdout: "piped" })
    .spawn()
    .stdout
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())
) {
  console.log(line);
}
```

This is really good compared to the old `Deno.run` which would leak resources if
you didn't close the process and (multiple) readers explicitly. Error handling
in child processes could also be tricky. In the new `Deno.Command`, all that is
handled in a sensible way, automatically. This is already a giant leap forward
for child process support in Deno.

There is still a lot of boilerplate though. Maybe we can do better.

## The Way of `proc`

Here are some approaches to running `ls` using `proc`. These are equivalent to
the code in the previous section - but simpler.

This is just `Deno.Command().spawn()` behind the scenes, with a slightly
different take on the API. It is equivalent to the first example.

```typescript
console.log(await run("ls", "-la").asString());
```

Or how about this? This is streaming output as text lines:

```typescript
for await (const line of lines(run("ls", "-la"))) {
  console.log(line);
}
```

If you really want the simplest version, there is also this (though you have no
way to get the output - it streams to the `stdout` of the Deno process):

```typescript
await execute("ls", "-la");
```

Ah! Minimal and clean.
