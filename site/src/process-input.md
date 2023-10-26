# Input

`proc` supports standard input (_stdin_) of processes as
`AsyncIterable<Uint8Array | Uint8Array[] | string | string[]>`. This means that
you can pass in text data or byte data.

Note that for every `string` value (including each `string` in a `string[]`),
`proc` will insert a line-feed character. This is not done for byte data in
`Uint8Array` form, of course. If you need to use text data without the automatic
line-feed characters, you will need to convert to bytes.

`enumerate` is a wrapper function that creates an `AsyncIterable` with
higher-order functions. In the example, I am using it to iterate over a few
`Uint8Array` instances that, together, spell out "Hello, world." This is
providing stdin to `wc -w`.

```typescript
// Count the words in 'Hello, world."
await enumerate([
  new Uint8Array([72, 101, 108, 108, 111, 44, 32]),
  new Uint8Array([119, 111, 114, 108, 100, 46, 10]),
]).run("wc", "-w").toStdout();

// 2
```

This also works with text data. `proc` converts strings to bytes automatically.

```typescript
await enumerate(["Hello, world."]).run("wc", "-w").toStdout();

// 2
```
