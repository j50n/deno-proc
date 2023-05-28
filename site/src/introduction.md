# Introduction

`proc` simplifies working with child processes in Typescript/Deno. Its goal is
to achieve the simplicity of shell scripts.

Deno is a great choice to replace your `bash` scripts when they become too
complex. Typescript scales up. Type checking and Deno's security-by-default make
it safer to use when you have to test in production. Deno has done away with the
package-manager concept, so you can run scripts from source without an
installation step. There is no project configuration needed by default.

_If only running child processes was not so damn complicated. It is easy in
`bash`. Why is it so hard in Deno?_

At the start of 2023, there was a major change. The Deno team deprecated
`Deno.run` in favor of `Deno.Command`. The new API was a major step forward.
Resource cleanup and error checking worked automatically. The resulting code was
cleaner. The performance was stellar.

_I think, though, that there is still some room for improvement._ Using the API
could be simpler, and the resulting code could be a lot easier to read.

---

**Introducing `proc`.** This is is a lightweight rethinking of the
`Deno.Command` API for use doing shell-script-like things. It makes the simple
things dead-simple and really cleans up the more complex ones.

The goal of `proc` is to make programming with processes as close to the
experience of shell scripting as possible. While the resulting code isn't as
terse as the equivalent shell script, it is pretty close to minimal for
Typescript syntax.

It should be possible to pipe the output of one process directly to another
without boilerplate. Command syntax should be simpler. Processing the output as
lines of text or as an array should be obvious. These are the kinds of things
that `proc` give you.

Note that `proc` is not reinventing or replacing `Deno.Command` at all. It is an
extension. It uses the same interfaces, the same methods, streams, etc., so you
can do things the same way you would - with the same performance - as
`Deno.Command`. You can use as much or as little of `proc` as you wish, taking
full control or doing it the "easy way."

Here are some working examples to give you an idea of some of the differences
between `proc` and out-of-the-box `Deno.Command`.

## The `Deno.Command` Way

Here are some different approaches to listing files using `ls` using
`Deno.Command`. The equivalent in `bash` would look like this:

```shell
ls -la
```

##### Example 1 (for `Command`)

To do this using `Deno.Command`, I can do this (output bytes captured all at
once, decoded to text):

```typescript
const output = await new Deno.Command("ls", { args: ["-la"] }).output();
console.log(new TextDecoder().decode(output.stdout));
```

##### Example 2 (for `Command`)

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

This is still really good compared to the old `Deno.run` - which would leak
resources if you didn't close the process and (multiple) readers explicitly.
Error handling in child processes could also be tricky. In the new
`Deno.Command`, all that is handled in a sensible way, automatically. This is
already a giant leap forward for child process support in Deno.

There is still a lot of boilerplate. Remember, the `bash` command is just
`ls -la` and everything works.

We can do better.

## The (Easy) Way of `proc`

Here are some approaches to running `ls` using `proc`. These are equivalent to
the code in the previous section - but simpler.

##### Example 1 (for `proc`)

This is equivalent to the first example. `stdout` of the process is fully
captured, converted to text, and returned when the process exits.

```typescript
console.log(await run("ls", "-la").asString());
```

##### Example 2 (for `proc`)

Or how about this? This is equivalent to the second example. This is streaming
`stdout` into text lines:

```typescript
for await (const line of lines(run("ls", "-la"))) {
  console.log(line);
}
```

If you really want the simplest version, there is also this (though you have no
access to `stdout`):

```typescript
await execute("ls", "-la");
```

Ah! You may take a moment now and breathe in the minimalism. Boilerplate ...
gone.
