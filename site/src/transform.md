## Transformers

A transformer is just a function with this signature:

```typescript
((it: AsyncIterable<T>) => AsyncIterable<U>);
```

A transformer transforms objects from one type to another. The chief difference
between this and a `map` operation is that you control the whole transformation,
so you can catch and throw errors emanating from the iteration and manage state.

You can easily create a transformer using an asynchronous generator. This one
will transform strings to lower-case:

```typescript
async function* toLower(texts: AsyncIterable<string>) {
  for await (const text of texts) {
    yield text.toLocaleLowerCase();
  }
}
```

Here is an example:

```typescript
const lowered = await enumerable(["A", "B", "C"])
  .transform(toLower)
  .collect();

assertEquals(lowered, ["a", "b", "c"], "Transformed to lower-case.");
```

The `transform` operation is analogous to `pipeThrough` in the streaming API.
