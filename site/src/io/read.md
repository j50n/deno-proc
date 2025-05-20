# Reading Data

[`enumerate`]() works with any iterable, including a `ReadableStream` (which is
an `AsyncIterable`). `proc` favors using `ReadableStream` because it works
automatically with `AsyncIterable` back-propagation, so it will close
automatically if the iteration terminates early.

## Reading from `stdin`

You can get a `ReadableStream<Uint8Array>` from `stdin` like this:
`Deno.stdin.readable`. We use `enumerate(...)` to add an `Enumerable` wrapper.

File `example.ts`:

```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

for await (const line of enumerate(Deno.stdin.readable).lines) {
  console.log(line);
}
```

_Notice the use of `.lines`. This converts the data to lines of text from
`Uint8Array`, or byte buffers._

To print War and Peace, line by line, to console:

```shell
cat warandpeace.txt.gz | gunzip | deno run example.ts
```

This operation will consume `stdin` and close it.

See [Enumerable]()

## Reading from File

Just as for `stdin`, files have a `ReadableStream<Uint8Array>` view. We can read
the file directly.

In this case, the file is compressed, so we need to decompress it before we can
extract the lines of text. I am using the `gunzip` transform function to do
this. This is using Deno's `new DecompressionStream("gzip")` transformer stream
behind the scenes. `gunzip` is a convenience function provided by `proc`.

```typescript
import { enumerate, gunzip } from "jsr:@j50n/proc@{{gitv}}";

const file = Deno.open("warandpeace.txt.gz");

for await (const line of enumerate(file.readable).transform(gunzip).lines) {
  console.log(line);
}
```

_No need to explicitly close the file. `ReadableStream` with iteration is
magical._

---

I could have also used this:

```typescript
enumerate(file.readable).run("gunzip").lines;
```

to pipe the data through the command `gunzip` in a child process.

Neither the transformer version nor the child-process version blocks the main
JavaScript/Typescript thread. Both versions are non-blocking.
