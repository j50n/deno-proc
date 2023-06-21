## Transformers

[Available Transformers](https://deno.land/x/proc@{{gitv}}/src/transformers.ts)

A transformer is just a _plain-old JavaScript function_ with this signature:

```typescript
type Transformer<T, U> = (it: AsyncIterable<T>) => AsyncIterable<U>;
```

Transformers are functions (possibly asynchronous generator functions). You
can compose them into new functions relatively easily. The
[transform](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=Enumerable#method_transform_0)
operation is similar to `pipeThrough` in streaming.

A transformer transforms objects from one type to another. It is like `map` but
with with complete control over the whole stream of data - including control
over error handling.

You can create a transformer using an asynchronous generator. This one will
transform strings to lower-case:

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
