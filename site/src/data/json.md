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

| Option       | Default     | Meaning                                                              |
| ------------ | ----------- | -------------------------------------------------------------------- |
| `schema`     | none        | an object whose `parse(value)` returns the value to yield, or throws |
| `sampleSize` | every value | check only the first `sampleSize` values                             |

Whatever `schema.parse` throws stops the stream and reaches your `catch`. What
it returns is the value you get, so a Zod schema's defaults and transforms
apply, and keys it doesn't know are stripped, as with any `parse` call.

With `sampleSize`, only the first `sampleSize` values go through the schema. The
rest come as `JSON.parse` made them, unchecked and untransformed, though they
are typed as the schema's output, just as values are with no schema at all. So
use `sampleSize` only with a schema that checks values without changing them.

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

`toJson()` takes one value per item and writes it on a line of its own, the
reverse of `fromJsonToRows()` followed by `.flatten()`. The parsers yield
batches, so flatten them first; a batch passed as it is would be written as one
JSON array on one line.

Inside a value, `JSON.stringify`'s rules apply: a property holding `undefined`
or a function is left out, and in an array it becomes `null`. An item with no
JSON form at all (`undefined`, a function, a symbol) throws a `TypeError` naming
the item, counted from 1, as the second half of the example shows. So does an
item `JSON.stringify` throws on, such as a `BigInt`. Items before it have
already been written.

## From JSON to rows

To write JSON values as CSV or TSV, turn each into an array of strings:
`.map((e) => [e.id, String(e.ms)])` after `.flatten()`, before `toCsv()`.

See
[`fromJsonToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromJsonToRows)
and [`toJson`](https://jsr.io/@j50n/proc/doc/transforms/~/toJson) for the
reference.
