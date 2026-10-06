# Record format

The record format puts `\x1F` (ASCII unit separator) between fields and `\x1E`
(record separator) after each row, with no quoting. A field can hold anything
else, tabs, quotes, and newlines included, and a program in any language reads
it by splitting twice.

```typescript
{{#include ../../examples/data/record-to-program.ts}}
```

```text
{{#include ../../examples/data/record-to-program.out}}
```

`toRecord()` writes it and `fromRecordToRows()` reads it. Reach for it when you
hand rows to another program, or take them from one, and the fields might hold
characters that would break TSV. Unlike CSV, the reading side needs no parser:
split the input on `\x1E`, dropping the empty piece after the last one, then
each record on `\x1F`. In awk, set `RS` and `FS` as above. The separators are
exported as `RECORD_SEPARATOR` and `FIELD_SEPARATOR`.

## Reading

```typescript
{{#include ../../examples/data/record-from-program.ts}}
```

```text
{{#include ../../examples/data/record-from-program.out}}
```

The input is split on `\x1E`, then each record on `\x1F`. Nothing else is
special. Text after the last `\x1E` is a final record, so a record needs no
`\x1E` at the end of the input. Every piece between separators counts:

- An empty record (`\x1E\x1E`) reads as `[""]`.
- A newline after the last `\x1E`, as `echo` or `print` adds, reads as a row
  `["\n"]`. Make the writer leave it off, or filter that row out.

Batches close at about 128 KiB of text. `fromRecordToLazyRows()` yields
string-backed LazyRows and does the same work, so it is no faster; use it only
when the code downstream expects `LazyRow`s.

## Writing

`toRecord()` refuses a field holding `\x1E` or `\x1F`, throwing an `Error` such
as `Invalid character (field separator) in record data at row 2, field 2`; rows
before it have already been written. Any other text is written as it is.

Unlike CSV and TSV, the record format keeps a row holding one empty field:
`[""]` is written as `\x1E` and reads back as `[""]`.

## The record format and flatdata

The [flatdata CLI](./flatdata.md) converts CSV and TSV to records in a separate
process (`flatdata csv2record`), so a program in another language can read CSV
without a CSV parser. It doesn't check fields, though: a CSV field holding
`\x1E` or `\x1F` comes out as extra records or fields.

See [`toRecord`](https://jsr.io/@j50n/proc/doc/transforms/~/toRecord) and
[`fromRecordToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromRecordToRows)
for the reference.
