## Transformers

`proc` ships with some useful
[transformers](https://deno.land/x/proc@{{gitv}}/src/transformers.ts).

A transformer is a _plain-old JavaScript function_ with this signature:

```typescript
type Transformer<T, U> = (it: AsyncIterable<T>) => AsyncIterable<U>;
```

Transformers are functions (and may be defined using asynchronous generator
functions). You can compose them into new functions relatively easily. The
[transform](https://deno.land/x/proc@{{gitv}}/mod3.ts?s=Enumerable#method_transform_0)
operation is like `pipeThrough` in streaming.

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

`proc` provides canned transform functions for:

- compression and decompression
- JSON serialization (for line-oriented JSON)
- conversion between byte data and string data

## Using `TransformStream` with `proc`

The
[JavaScript Steams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
is efficient, but it is unnecessarily awkward to use. Coding against it is
unintuitive, and error handling is an afterthought.

There are some powerful `TransformStream`s available, and we can steal them.
When you wrap `TransformStream` this way, errors are handled/propagated
correctly in the streamed data. You end up with much cleaner code.

To wrap a `TransformStream`, use the `transformerFromTransformStream` function.
This just returns a `(AsyncIterable<T>)=>AsyncIterable<T>`.

Here is the code for the `gunzip` function from `proc`. It takes byte data as
input and decompresses it to byte data.

```typescript
/**
 * Decompress a `gzip` compressed stream.
 */
export const gunzip: TransformerFunction<
  BufferSource,
  Uint8Array<ArrayBufferLike>
> = transformerFromTransformStream(
  new DecompressionStream("gzip"),
);
```

An example:

```typescript
enumerate("myfile.txt.gz")
  .transform(gunzip)
  .lines
  .foreach((line) => console.info(line));
```

As an alternative, I can pass the `TransformStream` in directly:

```typescript
enumerate("myfile.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .foreach((line) => console.info(line));
```
