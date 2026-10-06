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

| Format                  | Read with                                      | Write with   | The writer refuses a field holding |
| ----------------------- | ---------------------------------------------- | ------------ | ---------------------------------- |
| [CSV](./csv.md)         | `fromCsvToRows()`, `fromCsvToLazyRows()`       | `toCsv()`    | nothing: it quotes                 |
| [TSV](./tsv.md)         | `fromTsvToRows()`, `fromTsvToLazyRows()`       | `toTsv()`    | a tab, CR, or LF                   |
| [JSON lines](./json.md) | `fromJsonToRows()`                             | `toJson()`   | nothing, but it takes batches only |
| [Record](./record.md)   | `fromRecordToRows()`, `fromRecordToLazyRows()` | `toRecord()` | `\x1E` or `\x1F`                   |

- **CSV** to exchange data with spreadsheets, databases, and other people. Its
  parser is lenient; [CSV](./csv.md) says exactly what it accepts.
- **TSV** for simple tabular text whose fields never hold a tab or line break:
  logs, command output, files you grep.
- **JSON lines** when each item is an object (or any JSON value) rather than a
  row of strings.
- **Record** to hand rows to another program when fields may hold tabs, quotes,
  or newlines. Any language splits it with two calls.

To convert, chain any parser to any writer: `.transform(fromCsvToRows())` then
`.transform(toRecord())`. The row writers take what the row parsers yield,
batches and LazyRows included. Between CSV and TSV, `csvToTsv()` and
`tsvToCsv()` convert bytes to bytes without making rows, several times faster;
see [CSV](./csv.md#converting-to-and-from-tsv). JSON is the exception, since it
holds values rather than rows: map rows to objects before `toJson()`, and
objects to arrays of strings after `fromJsonToRows()`. [JSON lines](./json.md)
shows both.

## Batches

Parsers yield batches (arrays of rows), not single rows. Add `.flatten()` before
a step that works on one row (`filter`, `map`, `take`), as in
[Key ideas](../start/key-ideas.md). The row writers take a row or a batch per
item, so there is no need to flatten just to write. `toJson()` takes batches
only; see [JSON lines](./json.md) for the trap that sets.

## Row or LazyRow

A `Row` is a `string[]`, every field decoded. A `LazyRow` from
`fromCsvToLazyRows()` or `fromTsvToLazyRows()` holds the row's bytes and decodes
a field when you ask for it with `getField()`, or compares one without decoding
it with `fieldEquals()`. Use plain rows unless you filter on or read a few
fields of each row; [LazyRow](./lazyrow.md) has the details.

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
convert numbers yourself, and turn them back into strings before writing.

To write a header in front of rows, put it first:
`enumerate([header]).concat(rows)`, where `rows` is any `Enumerable` of rows.

The CSV and TSV parsers, and `csvToTsv()` and `tsvToCsv()`, run in WebAssembly
bundled with the package; the rest is TypeScript. None of them needs permissions
of its own; only `read()` and `writeTo()` do.

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
writing holds the rows up to that point. `toCsv()` refuses nothing.

Empty rows don't all survive a trip through CSV or TSV. `toCsv()` writes a row
`[""]` as `""`, which reads back as `[""]`, but `toTsv()` writes it as an empty
line, which the parser skips. A row `[]` inside a batch is written as an empty
line by both, and a `[]` passed on its own isn't written at all.

## What parsers refuse

The CSV and TSV parsers take lines ending in LF or CRLF. Any other CR outside a
quoted field, as in a file with old Mac CR-only line ends, throws an `Error`
such as `Invalid character (CR) in CSV data at row 1, field 2`, rather than read
the file as one long row. Invalid UTF-8 throws a `TypeError` from the parser,
or, for a LazyRow, when the field is decoded. Batches before the one holding the
error have already gone down the pipeline.

The [flatdata CLI](./flatdata.md) converts between the same formats in a
separate process, with the same checks.

## How fast

From `benchmarks/transforms-throughput.ts`: 100,000 rows of 20 fields (UTF-8,
about one field in ten quoted, some with newlines), median MB/s on one machine.
Your numbers will differ; the ratios are what matter.

| Reading                     | MB/s | Writing and converting | MB/s |
| --------------------------- | ---- | ---------------------- | ---- |
| `fromCsvToRows()`           | 130  | `toCsv()`              | 85   |
| `fromCsvToLazyRows()`       | 350  | `toTsv()`              | 90   |
| filter with `fieldEquals()` | 385  | `toRecord()`           | 80   |
| `fromTsvToRows()`           | 130  | `toJson()`             | 95   |
| `fromTsvToLazyRows()`       | 440  | `csvToTsv()`           | 610  |
| `fromRecordToRows()`        | 90   | `tsvToCsv()`           | 640  |
| `fromJsonToRows()`          | 95   |                        |      |

The LazyRow parsers are fast because they make no strings until asked, and
converting between CSV and TSV never makes any.

### Against other JavaScript

From `benchmarks/compare.ts`, on the same data. Here every reader keeps all
2,000,000 fields in memory, as a whole-string parser must, so the figures are
lower than the table above. The others get their best case, the whole file
decoded to one string; proc streams it in 64 KB chunks.

| CSV to rows                 | MB/s | Rows to CSV          | MB/s |
| --------------------------- | ---- | -------------------- | ---- |
| proc `fromCsvToRows()`      | 75   | proc `toCsv()`       | 75   |
| Papa Parse                  | 55   | `@std/csv` stringify | 50   |
| hand-written TypeScript     | 45   | Papa Parse unparse   | 25   |
| `@std/csv` `CsvParseStream` | 28   | csv-stringify        | 23   |
| `@std/csv` `parse`          | 19   |                      |      |
| csv-parse                   | 14   |                      |      |

Converting CSV to TSV, proc's `csvToTsv()` runs at about 450 MB/s here; reading
with the hand-written parser and joining the rows back runs at 30. Reading TSV,
proc and a plain `split` on the whole string are close (70 and 62): TSV has no
quoting to work out, so making the strings is nearly all the work.
