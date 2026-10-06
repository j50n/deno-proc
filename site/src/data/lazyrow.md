# LazyRow

A `LazyRow` is a row that decodes a field only when you read it. Use one when
you read a few fields of wide rows, or move rows from one format to another
without touching most fields.

```typescript
{{#include ../../examples/data/lazyrow-fields.ts}}
```

```text
{{#include ../../examples/data/lazyrow-fields.out}}
```

`fromCsvToLazyRows()` yields binary-backed LazyRows: each holds its fields as
UTF-8 bytes, and `getField(i)` decodes field `i` and caches it. The filter above
decodes one field of each row; a writer given an unchanged row copies its bytes
without decoding any. A changed row (`setField`) is re-encoded when it is
written.

## Methods

| Member                         | What it does                                                       |
| ------------------------------ | ------------------------------------------------------------------ |
| `columnCount`                  | the number of fields (a property)                                  |
| `getField(i)`                  | field `i`, counted from 0; `RangeError` outside `[0, columnCount)` |
| `setField(i, value)`           | replace field `i`; same `RangeError`                               |
| `toStringArray()`              | all fields as a new `string[]`                                     |
| `toBinary()`                   | the row in the binary layout, below                                |
| `isBinaryBacked()`             | `true` for bytes, `false` for a wrapped `string[]`                 |
| `LazyRow.fromStringArray(arr)` | wrap a `string[]`, without copying it                              |
| `LazyRow.fromBinary(bytes)`    | wrap one row in the binary layout, without copying or checking it  |

Every row writer (`toCsv`, `toTsv`, `toRecord`, `toLazyRowBinary`) takes
LazyRows, singly or in batches, mixed with plain rows if you like.

## When it doesn't help

Only `fromCsvToLazyRows()` and `fromLazyRowBinary()` yield binary-backed rows.
`fromTsvToLazyRows()` and `fromRecordToLazyRows()` split every line into strings
first and wrap the array, so they do all the work `fromTsvToRows()` does. If you
read every field anyway, `toStringArray()` decodes them all, and a plain `Row`
is simpler.

## The binary format

`toLazyRowBinary()` writes rows as length-prefixed fields, and
`fromLazyRowBinary()` reads them back as binary-backed LazyRows. Any string
survives, so it suits passing parsed rows between proc programs (one writes to
stdout, the next reads its stdin) or storing them to read again:

```typescript
{{#include ../../examples/data/lazyrow-binary.ts}}
```

```text
{{#include ../../examples/data/lazyrow-binary.out}}
```

Each row is a little-endian u32 byte length, then the layout `toBinary()`
returns: a u32 field count, a u32 byte length per field, and the fields' UTF-8
bytes. Only the length prefixes are checked when reading: input that ends
partway through a row throws an `Error` after the complete rows have been
yielded. The [flatdata CLI](./flatdata.md) reads and writes the same format
(`csv2lazyrow`, `lazyrow2csv`).

## Traps

- `setField` on a string-backed row writes into the array you gave
  `fromStringArray`, so that array changes too.
- `toBinary()` on an unchanged binary-backed row returns the bytes it holds, not
  a copy. Don't modify them.
- Invalid UTF-8 throws a `TypeError` from the `getField()` that decodes it, not
  from the parser, so a bad field nobody reads goes unnoticed.

See [`LazyRow`](https://jsr.io/@j50n/proc/doc/transforms/~/LazyRow) for the
reference.
