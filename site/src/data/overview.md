# Reading and writing data formats

`@j50n/proc/transforms` turns bytes into rows and rows back into bytes, a batch
at a time, so a CSV export or a process's output streams through your code in
constant memory.

```typescript
{{#include ../../examples/data/overview.ts}}
```

```text
{{#include ../../examples/data/overview.out}}
```

Each function returns a transformer for `.transform()`. A parser
(`fromCsvToRows()`, ...) takes bytes from `read()`, a command's output, or any
async iterable of `Uint8Array`. A writer (`toTsv()`, ...) yields bytes, ready
for `.writeTo()`, `.toStdout()`, or the stdin of the next command with `.run()`.
The transforms are a separate entry point, so import them from
`"@j50n/proc/transforms"`.

## Which format

| Format                         | Read with                                      | Write with          | The writer refuses a field holding |
| ------------------------------ | ---------------------------------------------- | ------------------- | ---------------------------------- |
| [CSV](./csv.md)                | `fromCsvToRows()`, `fromCsvToLazyRows()`       | `toCsv()`           | nothing: it quotes                 |
| [TSV](./tsv.md)                | `fromTsvToRows()`, `fromTsvToLazyRows()`       | `toTsv()`           | a tab, CR, or LF                   |
| [JSON lines](./json.md)        | `fromJsonToRows()`                             | `toJson()`          | nothing, but it takes batches only |
| [Record](./record.md)          | `fromRecordToRows()`, `fromRecordToLazyRows()` | `toRecord()`        | `\x1E` or `\x1F`                   |
| [LazyRow binary](./lazyrow.md) | `fromLazyRowBinary()`                          | `toLazyRowBinary()` | nothing                            |

- **CSV** to exchange data with spreadsheets, databases, and other people. Its
  parser is lenient and has a known bug that loses data silently; read
  [CSV](./csv.md) before you trust it with input you didn't write.
- **TSV** for simple tabular text whose fields never hold a tab or line break:
  logs, command output, files you grep.
- **JSON lines** when each item is an object (or any JSON value) rather than a
  row of strings.
- **Record** to hand rows to another program when fields may hold tabs, quotes,
  or newlines. Any language splits it with two calls.
- **LazyRow binary** to pass parsed rows between proc programs, or store them,
  without quoting or parsing again.

To convert, chain any parser to any writer: `.transform(fromCsvToRows())` then
`.transform(toRecord())`. The row writers take what the row parsers yield,
batches and LazyRows included. JSON is the exception, since it holds values
rather than rows: map rows to objects before `toJson()`, and objects to arrays
of strings after `fromJsonToRows()`. [JSON lines](./json.md) shows both.

## Batches

Parsers yield batches (arrays of rows), not single rows. Add `.flatten()` before
a step that works on one row (`filter`, `map`, `take`), as in
[Key ideas](../start/key-ideas.md). The row writers take a row or a batch per
item, so there is no need to flatten just to write. `toJson()` takes batches
only; see [JSON lines](./json.md) for the trap that sets.

## Row or LazyRow

A `Row` is a `string[]`, every field decoded. A `LazyRow` from
`fromCsvToLazyRows()` or `fromLazyRowBinary()` holds the row's bytes and decodes
a field when you ask for it with `getField()`. Use plain rows unless you read a
few fields of wide rows or pass rows straight from one format to another;
[LazyRow](./lazyrow.md) has the details.

## Header rows

No format has a header. A header line is the first row, like any other, so in
the example above it went through the filter and into the TSV. Skip it with
`.drop(1)`, or keep it to name the fields:

```typescript
{{#include ../../examples/data/header.ts}}
```

```text
{{#include ../../examples/data/header.out}}
```

`enum()` pairs each row with its index, counted from 0. Every field is a string;
convert numbers yourself.

## What writers refuse

A writer throws rather than write a field its format can't hold, since the
reader would split it into extra fields or rows:

```typescript
{{#include ../../examples/data/refuse.ts}}
```

```text
{{#include ../../examples/data/refuse.out}}
```

The `Error` names the row and field, both counted from 1 across the whole
stream. Items before the bad one have already been written, so a file you were
writing holds the rows up to that point. `toCsv()` and `toLazyRowBinary()`
refuse nothing.

Empty rows don't survive a trip through CSV or TSV. A row `[]` or `[""]` inside
a batch is written as an empty line, which the parsers skip, and a `[]` passed
on its own isn't written at all.

Invalid UTF-8 in the input throws a `TypeError` from the parser (for a
binary-backed LazyRow, from the `getField()` that decodes it).

The [flatdata CLI](./flatdata.md) converts between the same formats in a
separate process, without these checks.
