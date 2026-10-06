# JSON lines

JSON lines is one JSON value per line. `fromJsonToRows()` parses each line with
`JSON.parse`, and `toJson()` writes each value with `JSON.stringify`.

```typescript
{{#include ../../examples/data/json-read.ts}}
```

```text
{{#include ../../examples/data/json-read.out}}
```

Despite its name, `fromJsonToRows()` yields values, not rows: objects, arrays,
strings, numbers, anything JSON holds. They come in batches of about 128 KiB of
text, so `.flatten()` before working value by value. Blank lines, and lines of
only whitespace, are skipped. A CR at the end of a line is whitespace to
`JSON.parse`, so CRLF files read fine.

The type parameter (`fromJsonToRows<Event>()`) is only an assertion. Nothing
checks the values unless you pass a schema.

## Checking values

```typescript
{{#include ../../examples/data/json-schema.ts}}
```

```text
{{#include ../../examples/data/json-schema.out}}
```

| Option       | Default     | Meaning                                              |
| ------------ | ----------- | ---------------------------------------------------- |
| `schema`     | none        | an object whose `parse(value)` throws on a bad value |
| `sampleSize` | every value | check only the first `sampleSize` values             |

Whatever `schema.parse` throws stops the stream and reaches your `catch`. Its
return value is ignored: you get the value as `JSON.parse` made it, so Zod
transforms and defaults are not applied, and unknown keys are not stripped. Call
`schema.parse` yourself in a `.map()` if you want its result.

Note that `e1` never printed. A batch is parsed whole before it is yielded, so
an error stops the stream before any value in the same batch reaches you.

A line that isn't JSON throws the `SyntaxError` from `JSON.parse`. Its position
counts from the start of that line, and it doesn't say which line. To know,
parse the lines yourself: `.lines.enum()` gives each line its index.

## Writing

```typescript
{{#include ../../examples/data/json-write.ts}}
```

```text
{{#include ../../examples/data/json-write.out}}
```

`toJson()` takes batches (arrays of values), the shape the parsers yield, and
writes one line per value. Mapping each batch, as above, turns CSV rows into
objects without flattening.

The trap: after `.flatten()`, a stream of rows is a stream of arrays, and
`toJson()` takes each row as a batch, writing each field on a line of its own
with no error. Wrap single values in a batch of one, `.map((value) => [value])`,
as in the second half of the example.

A value `JSON.stringify` can't represent, such as `undefined` or a function, is
written as the text `undefined`, which won't parse back.

## From JSON to rows

To write JSON values as CSV or TSV, turn each into an array of strings:
`.map((batch) => batch.map((e) => [e.id, String(e.ms)]))` before `toCsv()`.

See
[`fromJsonToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromJsonToRows)
and [`toJson`](https://jsr.io/@j50n/proc/doc/transforms/~/toJson) for the
reference.
