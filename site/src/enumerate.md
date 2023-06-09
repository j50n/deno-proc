# enumerate

Create a new `Enumerable` with the `enumerate` factory method.

This can wrap another `AsyncIterable` or an `Iterable`. Passing `null` results
in an empty enumeration.

> ⚠️ Use the `enumerate` method rather than creating a `new Enumerable()`
> directly.

### Example 1

Use `enumerate` to turn an array of numbers into an `AsyncIterable`.

```typescript
await enumerate([1, 2, 3]).map((n) => n * 2).collect();

// [2, 4, 6]
```

### Example 2

Open a file. Use `enumerate` to wrap the `ReadableStream` from the file into an
`Enumerable`. Uncompress, strip out empty lines, and count them. Convert the
output from `wc -l` into a number.

```typescript
const file = await Deno.open(
  fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
);

const count = await enumerate(file.readable)
  .run("gunzip")
  .run("grep", "\S")
  .run("wc", "-l")
  .lines.map((n) => parseInt(n, 10))
  .first;

console.log(count);

// 2102
```
