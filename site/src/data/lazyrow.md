# LazyRow

A `LazyRow` is a row that decodes a field only when you read it. Use one when a
pipeline filters on a field or two, or reads a few fields of wide rows.

```typescript
{{#include ../../examples/data/lazyrow-fields.ts}}
```

```text
{{#include ../../examples/data/lazyrow-fields.out}}
```

`fromCsvToLazyRows()` and `fromTsvToLazyRows()` yield rows that are views of the
bytes the WebAssembly parser produced. `getField(i)` decodes field `i` alone,
and `fieldEquals(i, value)` compares field `i` with `value` byte by byte,
without making a string, so the filter above decodes nothing. It is the fastest
way to filter: about three times the speed of `fromCsvToRows()`, as
[How fast](./overview.md#how-fast) shows.

## Methods

| Member                         | What it does                                                       |
| ------------------------------ | ------------------------------------------------------------------ |
| `columnCount`                  | the number of fields (a property)                                  |
| `getField(i)`                  | field `i`, counted from 0; `RangeError` outside `[0, columnCount)` |
| `fieldEquals(i, value)`        | whether field `i` is exactly `value`; same `RangeError`            |
| `toStringArray()`              | all fields as a new `string[]`                                     |
| `LazyRow.fromStringArray(arr)` | wrap a `string[]`, without copying it                              |

A LazyRow can't be changed. To change a row, take `toStringArray()` and change
the array, as the example does; the writers take plain rows as well. Every row
writer (`toCsv`, `toTsv`, `toRecord`) takes LazyRows, singly or in batches,
mixed with plain rows if you like.

## When it doesn't help

`fromRecordToLazyRows()` splits every record into strings first and wraps the
array, so it does all the work `fromRecordToRows()` does. If you read every
field anyway, `toStringArray()` decodes them all, and a plain `Row` is simpler.

## Traps

- A row from CSV or TSV keeps its whole batch alive, the rows of about 128 KiB
  of input. To hold on to a few rows from a large stream, keep their
  `toStringArray()` instead.
- Invalid UTF-8 throws a `TypeError` when it is decoded, not from the parser, so
  a bad field nobody reads goes unnoticed. `toStringArray()` decodes the row's
  whole batch at once, so it throws if any row in the batch is bad.

See [`LazyRow`](https://jsr.io/@j50n/proc/doc/transforms/~/LazyRow) for the
reference.
