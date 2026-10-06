# Reading and writing data formats

`@j50n/proc/transforms` turns bytes into rows and rows back into bytes, a batch
at a time, so a CSV export or a process's output streams through your code
without being read whole into memory.

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
| [JSON lines](./json.md) | `fromJsonToRows()`                             | `toJson()`   | a value with no JSON form          |
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
item, so there is no need to flatten just to write. `toJson()` takes one value
per item, so flatten before it; see [JSON lines](./json.md).

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
writing holds the rows up to that point. `toCsv()` refuses no field.

A writer also refuses a row that would read back as no row, or as a different
one, with an error such as `Invalid row (no fields) in CSV data at row 3`:

| Row                        | `toCsv()`                        | `toTsv()` | `toRecord()`                       |
| -------------------------- | -------------------------------- | --------- | ---------------------------------- |
| `[""]`, one empty field    | writes `""`, reads back the same | refuses   | writes `\x1E`, reads back the same |
| `[]` inside a batch        | refuses                          | refuses   | refuses                            |
| `[]` as an item on its own | an empty batch: writes nothing   | the same  | the same                           |

`csvToTsv()` refuses a CSV row of one empty field, as `toTsv()` does. Every row
writer refuses a field holding a lone surrogate, which UTF-8 can't hold
(`TextEncoder` would write U+FFFD in its place). A first field starting with
U+FEFF would be dropped by the reader as a byte order mark, so `toCsv()` and
`tsvToCsv()` quote it and the others refuse it.

## What parsers refuse

The CSV and TSV parsers take lines ending in LF or CRLF. Any other CR outside a
quoted field, as in a file with old Mac CR-only line ends, throws an `Error`
such as `Invalid character (CR) in CSV data at row 1, field 2`, rather than read
the file as one long row. The CSV parser throws on a quote still open at the end
of the input, `Unclosed quote in CSV data at row 7, field 3`, rather than make
the rest of the file one field. Invalid UTF-8 throws a `TypeError` such as
`Invalid UTF-8 in CSV data at row 3001, field 2` (a file saved as Latin-1 or
Windows-1252 is the usual cause) from the parser, or, for a LazyRow, when the
field is decoded. Batches before the one holding the error have already gone
down the pipeline.

A parser's row numbers count rows, from 1, with the header row included. Blank
lines are skipped and not counted, and a quoted CSV field can span lines, so a
row number is the line number only in a file with neither.

The [flatdata CLI](./flatdata.md) converts between the same formats in a
separate process, with the same checks.

## How fast

From `benchmarks/transforms-throughput.ts`: 100,000 rows of 20 fields (UTF-8,
about one field in ten quoted, some with newlines), median MB/s on one machine.
Your numbers will differ; the ratios are what matter.

| Reading                     | MB/s | Writing and converting | MB/s |
| --------------------------- | ---- | ---------------------- | ---- |
| `fromCsvToRows()`           | 130  | `toCsv()`              | 75   |
| `fromCsvToLazyRows()`       | 430  | `toTsv()`              | 85   |
| filter with `fieldEquals()` | 385  | `toRecord()`           | 80   |
| `fromTsvToRows()`           | 130  | `toJson()`             | 60   |
| `fromTsvToLazyRows()`       | 455  | `csvToTsv()`           | 670  |
| `fromRecordToRows()`        | 90   | `tsvToCsv()`           | 590  |
| `fromJsonToRows()`          | 95   |                        |      |

The LazyRow parsers are fast because they make no strings until asked, and
converting between CSV and TSV never makes any.

### Lots of rows

The figures above are for a program that handles each batch with plain code. A
step after `.flatten()` (`filter`, `map`, `forEach`) is an `await` per row,
about a microsecond each, which on small rows costs more than the parsing. With
millions of rows, work a batch at a time, with the array's own methods inside
one step:

```typescript
{{#include ../../examples/data/rows-batch.ts}}
```

```text
{{#include ../../examples/data/rows-batch.out}}
```

Both count the same rows. On 100,000 rows of 20 fields, the filter ran at about
290 MB/s a batch at a time and 135 MB/s row by row; on rows of 25 bytes, row by
row fell to about 25 MB/s. It is the same advice as `.chunkedLines` for lines of
text.

### Against other JavaScript

From `benchmarks/compare.ts`, on the same data. Here every reader keeps all
2,000,000 fields in memory, as a whole-string parser must, so the figures are
lower than the table above. The others get their best case, the whole file
decoded to one string; proc streams it in 64 KB chunks.

| CSV to rows                 | MB/s | Rows to CSV          | MB/s |
| --------------------------- | ---- | -------------------- | ---- |
| proc `fromCsvToRows()`      | 72   | proc `toCsv()`       | 66   |
| Papa Parse                  | 53   | `@std/csv` stringify | 45   |
| hand-written TypeScript     | 43   | Papa Parse unparse   | 23   |
| `@std/csv` `CsvParseStream` | 26   | csv-stringify        | 22   |
| `@std/csv` `parse`          | 18   |                      |      |
| csv-parse                   | 14   |                      |      |

Converting CSV to TSV, proc's `csvToTsv()` runs at about 540 MB/s here; reading
with the hand-written parser and joining the rows back runs at 30. Reading TSV,
proc and a plain `split` on the whole string are close (72 and 59): TSV has no
quoting to work out, so making the strings is nearly all the work.
