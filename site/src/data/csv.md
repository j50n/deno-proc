# CSV

`fromCsvToRows()` parses CSV into batches of rows, and `toCsv()` writes rows as
CSV, quoting the fields that need it.

```typescript
{{#include ../../examples/data/csv-read.ts}}
```

```text
{{#include ../../examples/data/csv-read.out}}
```

The quotes are gone: `"Gear ""XL"""` in the file is `Gear "XL"` in the row. The
first row is the header, read like any other row; see
[Header rows](./overview.md#header-rows). The parser runs in WebAssembly and
yields a batch of rows for about every 128 KiB of input, so `.flatten()` comes
before the per-row steps.

`fromCsvToLazyRows()` parses the same way but yields [LazyRows](./lazyrow.md),
which decode a field only when you read it.

## Writing

```typescript
{{#include ../../examples/data/csv-write.ts}}
```

```text
{{#include ../../examples/data/csv-write.out}}
```

`toCsv()` quotes a field that holds the separator, a quote, CR, or LF, and
doubles the quotes inside it. Other fields are written as they are, spaces
included. It refuses nothing. Each item can be a row or a batch, of `Row`s or
`LazyRow`s.

## Options

| Option      | Used by             | Default | Meaning                              |
| ----------- | ------------------- | ------- | ------------------------------------ |
| `separator` | all of them         | `","`   | the field separator                  |
| `crlf`      | `toCsv`, `tsvToCsv` | `false` | end each row with CRLF instead of LF |

The separator must be one ASCII character other than `"`, CR, or LF. `";"`,
`"|"`, and `"\t"` all work. Anything else throws a `RangeError` from the call
that takes the options, such as `fromCsvToRows()` itself, before any data moves.
There are no other options: no header handling, no quote character, no comment
lines (a line starting with `#` is data), no trimming.

## What the parser accepts

It reads RFC 4180 and is lenient about the rest. The one thing it refuses is a
CR outside quotes that isn't part of a CRLF:

```typescript
{{#include ../../examples/data/csv-edge-cases.ts}}
```

```text
{{#include ../../examples/data/csv-edge-cases.out}}
```

- LF and CRLF end a row, and the last row needs no line end.
- Blank lines are skipped, but `""` on a line is a row holding one empty field;
  `toCsv()` writes such a row that way, so it survives a round trip, as the last
  line shows.
- A quoted field can hold separators, line breaks (CR included), and doubled
  quotes.
- Rows may have different numbers of fields. Check `row.length` if yours must
  match.
- Spaces around a field are kept. A quote opens a quoted field only at the very
  start of a field, so a quote after a space, or inside an unquoted field, is
  text. Text after a closing quote is kept: `"ab" ,c` reads as `["ab ", "c"]`.
- An unclosed quote runs to the end of the input, and everything after it
  becomes one field.
- A UTF-8 byte order mark at the start, as spreadsheet programs write, is
  dropped.
- Any other CR outside quotes throws an `Error` naming the row and field, so a
  file with CR-only line ends fails at its first line rather than reading as one
  long row. Batches before the one holding it have already been yielded.

## Converting to and from TSV

`csvToTsv()` and `tsvToCsv()` convert bytes to bytes in WebAssembly, without
making rows or strings, several times faster than a parser and a writer:

```typescript
{{#include ../../examples/data/csv-convert.ts}}
```

```text
{{#include ../../examples/data/csv-convert.out}}
```

They read and write as the parsers and writers do. TSV can't hold a tab, CR, or
LF in a field, so `csvToTsv()` throws on a CSV field holding one, as `toTsv()`
does; the output passed on before it can end partway through a row. A row of one
empty field comes out of `csvToTsv()` as a blank line, which TSV readers skip.

## Other traps

- Invalid UTF-8 throws a `TypeError` from `fromCsvToRows()` as its batch is
  converted, and from `fromCsvToLazyRows()` only when the bad field is decoded.
- Every field is a string. `Number(row[3])` for numbers; an empty field is `""`,
  and `Number("")` is `0`.

See [`fromCsvToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromCsvToRows),
[`toCsv`](https://jsr.io/@j50n/proc/doc/transforms/~/toCsv), and
[`csvToTsv`](https://jsr.io/@j50n/proc/doc/transforms/~/csvToTsv) for the
reference.
