# LazyRow Guide

Rows whose fields are decoded only when you read them.

> ⚠️ **Experimental (v0.24.0+)**: LazyRow is under active development. API may
> change as we improve correctness and streaming performance. Test thoroughly
> with your data patterns.

## Overview

`fromCsvToLazyRows()` and `fromTsvToLazyRows()` yield rows that are views of the
bytes the WebAssembly reader produced. Nothing is decoded until you ask for a
field, so a pipeline that looks at a few fields of each row (a filter, a
projection) skips most of the work of making strings.

| Method                      | What it does                                       |
| --------------------------- | -------------------------------------------------- |
| `columnCount`               | Number of fields in the row                        |
| `getField(i)`               | Decodes field `i` and returns it                   |
| `fieldEquals(i, value)`     | Compares field `i` with `value` without decoding   |
| `toStringArray()`           | All fields, as a new array                         |
| `LazyRow.fromStringArray()` | Wraps a string array, for code that takes LazyRows |

Out-of-range indexes throw a `RangeError`. A LazyRow can't be changed; to change
a row, take `toStringArray()` and work on the array.

## Filtering

`fieldEquals` compares bytes, so it is the fastest way to filter:

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToLazyRows } from "jsr:@j50n/proc@{{gitv}}/transforms";

const names = await read("users.csv")
  .transform(fromCsvToLazyRows())
  .flatten()
  .filter((row) => row.fieldEquals(2, "active"))
  .map((row) => row.getField(0))
  .collect();
```

On realistic data (quoted fields, UTF-8), filtering this way runs at about three
times the speed of `fromCsvToRows()` with `row[2] === "active"`.

## Reading every field

`toStringArray()` decodes the row's whole batch once and slices it, so taking
every field of every row costs about the same as `fromCsvToRows()`. If you need
every field anyway, `fromCsvToRows()` is the simpler choice.

## Where LazyRows come from

- `fromCsvToLazyRows()` and `fromTsvToLazyRows()`: views of the reader's bytes.
- `fromRecordToLazyRows()`: wraps the string arrays the record reader makes.
- `LazyRow.fromStringArray(fields)`: wraps your own array.

All of them work with `toCsv()`, `toTsv()` and `toRecord()`, alone or in
batches:

```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToLazyRows, toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

await read("orders.csv")
  .transform(fromCsvToLazyRows())
  .map((batch) => batch.filter((row) => row.fieldEquals(3, "shipped")))
  .transform(toTsv())
  .writeTo("shipped.tsv");
```

## Next Steps

- [CSV Transforms](./csv.md)
- [TSV Transforms](./tsv.md)
- [Performance Guide](./performance.md)
