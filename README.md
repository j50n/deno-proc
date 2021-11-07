# deno-proc

Abstractions for running processes in Deno.

This is currently just an idea I have, and just getting started. I decided to
try creating the repository and publishing it right from the get-go, so the
entire development history will be captured. As of the first release, it doesn't
actually do anything. It is in active development though.

## `stdout` from a process as lines

```ts
for await (const line of new Proc({cmd: ["ls", "-la"]}).stdoutLines()){
    console.log(line);
}
```
