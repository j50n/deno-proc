# TSV

TSV is a tab between fields and a line feed after each row, with no quoting.
`fromTsvToRows()` reads it and `toTsv()` writes it.

```typescript
{{#include ../../examples/data/tsv-read.ts}}
```

```text
{{#include ../../examples/data/tsv-read.out}}
```

The parser is the CSV parser with a tab separator and quoting turned off, in
WebAssembly, and yields a batch of rows for about every 128 KiB of input. There
are no options.

Because nothing is quoted, TSV suits data you also want to read with `cut`,
`awk`, or `grep`, and whose fields never hold a tab or a line break. When they
might, use [CSV](./csv.md) or the [record format](./record.md).

## Edge cases

```typescript
{{#include ../../examples/data/tsv-edge-cases.ts}}
```

```text
{{#include ../../examples/data/tsv-edge-cases.out}}
```

- Lines end in LF or CRLF, and the last line needs no LF.
- Blank lines are skipped. A line holding only spaces, or only a tab, is a row.
- Quotes are text. A CSV-style quoted field doesn't protect a tab.
- A CR anywhere else throws an `Error` naming the row and field, so a file with
  CR-only line ends fails at its first line. TSV can't hold a CR in a field.
- A UTF-8 byte order mark at the start is dropped.

## Writing

`toTsv()` joins fields with tabs and ends each row with LF. A field holding a
tab, CR, or LF throws an `Error` naming the row and field, as in
`Invalid character (tab) in TSV data at row 2, field 2`; rows before it have
already been written ([What writers refuse](./overview.md#what-writers-refuse)
shows one). If your fields might hold them and a lossy fix is acceptable,
replace them first:

```typescript
{{#include ../../examples/data/tsv-write.ts}}
```

```text
{{#include ../../examples/data/tsv-write.out}}
```

## LazyRows from TSV

`fromTsvToLazyRows()` yields [LazyRows](./lazyrow.md) that decode a field only
when you read it. To filter on a field or two, it is several times faster than
`fromTsvToRows()`.

To convert TSV to CSV, `tsvToCsv()` skips the rows altogether; see
[CSV](./csv.md#converting-to-and-from-tsv).

See [`fromTsvToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromTsvToRows)
and [`toTsv`](https://jsr.io/@j50n/proc/doc/transforms/~/toTsv) for the
reference.
