# Reading Data

[`enumerate`]() works with any iterable, including a `ReadableStream` (which is an `AsyncIterable`).

## Reading from `stdin`

Deno provides `Deno.stdin.readable` which gives you a `stdin` as a `ReadableStream<Uint8Array>`. We can
wrap this with `enumerate(...)` to convert to lines of text (strings).

Text of `example.ts`:

```typescript
import { enumerate } from "https://deno.land/x/proc@{{gitv}}/mod.ts";

for await (const line of enumerate(Deno.stdin.readable).lines) {
  console.log(line);
}
```

To print War and Peace, line by line, to console:

```shell
zcat warandpeace.txt.gz | deno run example.ts
```

This operation will consume `stdin` and close it.
