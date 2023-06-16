## Transformers

[Available Transformers](https://deno.land/x/proc@{{gitv}}/src/transformers.ts)

A transformer is just a function with this signature:

```typescript
type transform = (it: AsyncIterable<T>) => AsyncIterable<U>;
```

A transformer transforms objects from one type to another. The chief difference
between this and a `map` operation is that you have full control over the iteration and
the output, including access to errors thrown upstream.

You can easily create a transformer using an asynchronous generator. This one
will transform strings to lower-case:

```typescript
async function* toLower(texts: AsyncIterable<string>) {
  for await (const text of texts) {
    yield text.toLocaleLowerCase();
  }
}
```

Here it is in action:

```typescript
const lowered = await enumerable(["A", "B", "C"])
  .transform(toLower)
  .collect();

assertEquals(lowered, ["a", "b", "c"], "Transformed to lower-case.");
```

The `transform` operation works similarly to `pipeThrough` in streaming.
