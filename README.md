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
for await (const line of new Proc({ cmd: ["ls", "-la"] }).stdoutLines()) {
  console.log(line);
}
```
