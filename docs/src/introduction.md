# Introduction



## The `Command.Deno` Way

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

This is actually really good compared to the old `Deno.run` which would leak
resources if you didn't close the process and (multiple) readers explicitly. Error handling
in child processes could also be tricky. In the new `Deno.Command`, all that is
handled in a sensible way, automatically.

There is still a lot of boilerplate though. Maybe we can do better.

## The Way of `proc` 

Here are some approaches to running `ls` using `proc`. These are equivalent to
the code in the previous section but more terse.

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
