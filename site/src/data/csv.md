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
included, except that a first field starting with U+FEFF is quoted, since
readers drop a byte order mark at the start. It refuses only what CSV can't
hold: a row with no fields (`[]` inside a batch), which would be a blank line
and read back as no row, and a field holding a lone surrogate, which UTF-8 can't
hold. Each item can be a row or a batch, of `Row`s or `LazyRow`s.

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

It reads RFC 4180 and is lenient about the rest. It refuses two things: a CR
outside quotes that isn't part of a CRLF, and a quote still open at the end of
the input:

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
- Rows may have different numbers of fields. Check `row.length` (a LazyRow's
  `columnCount`) if yours must match: `getField` past the end throws a
  `RangeError` that can't say which row, so count rows yourself to report one.
- Spaces around a field are kept. A quote opens a quoted field only at the very
  start of a field, so a quote after a space, or inside an unquoted field, is
  text. Text after a closing quote is kept: `"ab" ,c` reads as `["ab ", "c"]`.
- A UTF-8 byte order mark at the start, as spreadsheet programs write, is
  dropped.
- Any other CR outside quotes throws an `Error` naming the row and field, so a
  file with CR-only line ends fails at its first line rather than reading as one
  long row.
- A quote still open at the end of the input throws an `Error` naming the row
  and field where it opened, as in
  `Unclosed quote in CSV data at row 1, field 2`, rather than make the rest of
  the file one field.

Either error comes after the batches before the one holding it have been
yielded.

## Converting to and from TSV

`csvToTsv()` and `tsvToCsv()` convert bytes to bytes in WebAssembly, without
making rows or strings, several times faster than a parser and a writer:

```typescript
{{#include ../../examples/data/csv-convert.ts}}
```

```text
{{#include ../../examples/data/csv-convert.out}}
```

They read and write as the parsers and writers do, errors included. TSV can't
hold a tab, CR, or LF in a field, so `csvToTsv()` throws on a CSV field holding
one, as `toTsv()` does. Nor can it hold a row of one empty field (`""` on a
line), which would be a blank line, so `csvToTsv()` throws on that too:
`Invalid row (one empty field) in TSV data at row 4`. The first error in the
input is the one thrown: an unclosed quote whose field takes in a line break
reports the LF. The output passed on before it can end partway through a row.

They copy field bytes without decoding them, so invalid UTF-8 doesn't throw
here: it passes through to the output unchanged, as text in any other
ASCII-compatible encoding does. The parsers would throw a `TypeError` on the
same input.

## Other traps

- Invalid UTF-8 throws a `TypeError` naming the row and field, from
  `fromCsvToRows()` as its batch is converted, and from `fromCsvToLazyRows()`
  only when the bad field is decoded.
- Every field is a string. `Number(row[3])` for numbers; an empty field is `""`,
  and `Number("")` is `0`.
- A row is held whole until it ends, in the WebAssembly module's memory, which
  can't pass 4 GiB. A row of around a gigabyte is too large, and throws
  `Row too large for the WebAssembly module's memory in CSV data at row 7`.
  `tsvToCsv()` holds the longest field whole instead, with about the same limit.
  The memory a row took isn't given back until the stream ends, and it grows by
  doubling, so untrusted input can use about three times its size: a quote
  opened near the start and never closed holds all the rest before the error.
  Each open stream also holds a floor of about 1 MiB.

See [`fromCsvToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromCsvToRows),
[`toCsv`](https://jsr.io/@j50n/proc/doc/transforms/~/toCsv), and
[`csvToTsv`](https://jsr.io/@j50n/proc/doc/transforms/~/csvToTsv) for the
reference.
