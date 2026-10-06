# TSV

TSV is a tab between fields and a line feed after each row, with no quoting.
`fromTsvToRows()` reads it and `toTsv()` writes it.

```typescript
{{#include ../../examples/data/tsv-read.ts}}
```

```text
{{#include ../../examples/data/tsv-read.out}}
```

The parser splits each line on tabs, in plain TypeScript, and yields batches of
about 128 KiB of text (`BATCH_SIZE_BYTES`). There are no options.

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

- A CR before the LF is dropped, so CRLF files read like LF files. A CR anywhere
  else stays in the field.
- Blank lines are skipped. A line holding only spaces, or only a tab, is a row.
- Quotes are text. A CSV-style quoted field doesn't protect a tab.
- The last line needs no LF.

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

`fromTsvToLazyRows()` yields LazyRows, but string-backed ones: every line is
decoded and split as it is read, the same work `fromTsvToRows()` does. It is no
faster, so use it only when the code downstream expects `LazyRow`s.

See [`fromTsvToRows`](https://jsr.io/@j50n/proc/doc/transforms/~/fromTsvToRows)
and [`toTsv`](https://jsr.io/@j50n/proc/doc/transforms/~/toTsv) for the
reference.
