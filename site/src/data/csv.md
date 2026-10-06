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
yields batches of up to 100 rows, so `.flatten()` comes before the per-row
steps.

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

| Option      | Used by          | Default | Meaning                              |
| ----------- | ---------------- | ------- | ------------------------------------ |
| `separator` | parsers, `toCsv` | `","`   | the field separator                  |
| `crlf`      | `toCsv`          | `false` | end each row with CRLF instead of LF |

The separator must be one ASCII character other than `"`, CR, or LF. `";"`,
`"|"`, and `"\t"` all work. Anything else throws a `RangeError` from
`fromCsvToRows()`, `fromCsvToLazyRows()`, or `toCsv()` itself, before any data
moves. There are no other options: no header handling, no quote character, no
comment lines (a line starting with `#` is data), no trimming.

## What the parser accepts

It reads RFC 4180 and is lenient about the rest. It never throws on malformed
input:

```typescript
{{#include ../../examples/data/csv-edge-cases.ts}}
```

```text
{{#include ../../examples/data/csv-edge-cases.out}}
```

- LF, CRLF, and a lone CR all end a row, and the last row needs no line end. One
  exception: a CR at the very start of a field is dropped rather than ending the
  row, so `a,\rb` reads as `["a", "b"]`.
- Blank lines are skipped, but `""` on a line is a row holding one empty field.
- A quoted field can hold separators, line breaks, and doubled quotes.
- Rows may have different numbers of fields. Check `row.length` if yours must
  match.
- Spaces around a field are kept, so a quote after a space is text, as is a
  quote inside an unquoted field.
- An unclosed quote runs to the end of the input, and everything after it
  becomes one field.

The last line of the output is the round-trip trap from the
[overview](./overview.md#what-writers-refuse): a row holding one empty field is
written as a blank line, and read back as nothing.

## The silent-stop bug

Text between a closing quote and the next separator or line end, as in `"ab" ,c`
or `"ab"cd`, makes the parser stop. It throws nothing, and data is lost:

```typescript
{{#include ../../examples/data/csv-silent-stop.ts}}
```

```text
{{#include ../../examples/data/csv-silent-stop.out}}
```

Everything after the bad field is gone, and so are the rows already parsed from
the same chunk of input (up to 64 KiB): here, the whole file but the start of
the bad row. Rows from earlier pieces have already been yielded, so a large file
comes back cut short, with a fragment as its last row.

This lives in the WebAssembly parser, which is being rewritten. Until then, if
you read CSV that people edit by hand or unknown programs write, parse it with a
strict parser instead: `CsvParseStream` from
[`@std/csv`](https://jsr.io/@std/csv) throws a `SyntaxError` naming the line for
the same input. CSV that `toCsv()` wrote never has the problem. The
[parser specification](../contributor/csv-parser.md) has the exact behavior.

## Other traps

- A row with more than 1,024 fields, or more than 4 MiB of text, is damaged
  without an error: the extra fields run together into the last one, and text
  past 4 MiB is dropped. See the
  [specification](../contributor/csv-parser.md#limits).
- Invalid UTF-8 throws a `TypeError` from `fromCsvToRows()` as its batch is
  converted, and from `fromCsvToLazyRows()` only when `getField()` reads the bad
  field.
- Every field is a string. `Number(row[3])` for numbers; an empty field is `""`,
  and `Number("")` is `0`.

See [`fromCsvToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromCsvToRows)
and [`toCsv`](https://jsr.io/@j50n/proc/doc/transforms/~/toCsv) for the
reference.
