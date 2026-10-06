/**
 * Claims about LazyRow: a row read from CSV or TSV, a view of the reader's
 * bytes, behaves exactly like a row built from strings.
 *
 * @module
 */

import { assert, assertEquals, assertThrows } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  fromCsvToLazyRows,
  fromTsvToLazyRows,
  LazyRow,
} from "../../src/transforms/mod.ts";
import { lazyRows } from "../../src/transforms/lazy-row.ts";
import { readRows } from "../../src/wasm/flatdata.ts";
import { chunked, writeCsvReference } from "./reference.ts";

const encoder = new TextEncoder();

const ROWS = [
  ["hello", "world", "test"],
  ["", "middle", ""],
  ["single"],
  [""],
  ["café", "🎉", "東京", "a,b", 'say "hi"', "two\nlines"],
];

/** The rows above, read from CSV into LazyRows. */
function readLazy(rows: string[][]): Promise<LazyRow[]> {
  return enumerate([encoder.encode(writeCsvReference(rows))])
    .transform(fromCsvToLazyRows()).flatten().collect();
}

/** Both kinds of row for each of `rows`. */
async function bothKinds(rows: string[][]): Promise<[string, LazyRow][]> {
  const read = await readLazy(rows);
  return rows.flatMap((row, i): [string, LazyRow][] => [
    [`strings ${i}`, LazyRow.fromStringArray([...row])],
    [`read ${i}`, read[i]],
  ]);
}

Deno.test("A LazyRow read from CSV answers like one built from the same strings.", async () => {
  for (const [what, row] of await bothKinds(ROWS)) {
    const expected = ROWS[Number(what.split(" ")[1])];
    assert(row instanceof LazyRow, what);
    assertEquals(row.columnCount, expected.length, what);
    assertEquals(row.toStringArray(), expected, what);
    expected.forEach((field, i) => {
      assertEquals(row.getField(i), field, what);
      assert(row.fieldEquals(i, field), what);
    });
  }
});

Deno.test("fieldEquals is true only for exactly the field's text.", async () => {
  const [, read] = (await bothKinds([["abc", "", "é🎉"]]))[1];
  for (
    const [i, other] of [[0, "ab"], [0, "abcd"], [0, "ABC"], [1, " "], [
      2,
      "e🎉",
    ], [2, "é"]] as const
  ) {
    assert(!read.fieldEquals(i, other), `${i} ${other}`);
  }
  // Alternating values, as a filter on two fields would.
  for (let k = 0; k < 3; k++) {
    assert(read.fieldEquals(0, "abc"));
    assert(read.fieldEquals(2, "é🎉"));
    assert(read.fieldEquals(1, ""));
  }
});

Deno.test("Reading a field out of range throws a RangeError.", async () => {
  for (const [what, row] of await bothKinds([["a", "b"]])) {
    for (const index of [-1, 2, 10, 0.5, NaN]) {
      assertThrows(() => row.getField(index), RangeError, undefined, what);
      assertThrows(
        () => row.fieldEquals(index, "a"),
        RangeError,
        undefined,
        what,
      );
    }
  }
});

Deno.test("toStringArray returns a copy the caller may change.", async () => {
  for (const [what, row] of await bothKinds([["a", "b"]])) {
    const fields = row.toStringArray();
    fields[0] = "changed";
    assertEquals(row.getField(0), "a", what);
    assertEquals(row.toStringArray(), ["a", "b"], what);
  }
});

Deno.test("Fields read one at a time agree with toStringArray, in any order.", async () => {
  const rows = [["one", "twö", "3"], ["🎉", "", "six"]];
  const read = await readLazy(rows);
  // Before any row of the batch has been read whole, and after.
  assertEquals(read[1].getField(0), "🎉");
  assertEquals(read[0].toStringArray(), rows[0]);
  assertEquals(read[1].getField(2), "six");
  assertEquals(read[1].getField(1), "");
  assertEquals(read[1].toStringArray(), rows[1]);
});

Deno.test("Rows outlive the batch they were read in.", async () => {
  // Small chunks make many batches, each reusing the reader's memory.
  const rows = Array.from(
    { length: 200 },
    (_, i) => [`r${i}`, "é".repeat(i % 7)],
  );
  const kept: LazyRow[] = [];
  const csv = encoder.encode(writeCsvReference(rows));
  for await (
    const batch of readRows(enumerate(chunked(csv, 16)), 0x2C, true, 16)
  ) {
    kept.push(...lazyRows(batch));
  }
  assertEquals(kept.map((row) => row.toStringArray()), rows);
});

Deno.test("Rows read from TSV are lazy rows too.", async () => {
  const rows = await enumerate([encoder.encode('a\tb\n"q"\t\n')])
    .transform(fromTsvToLazyRows()).flatten().collect();
  assertEquals(rows.map((row) => row.toStringArray()), [["a", "b"], [
    '"q"',
    "",
  ]]);
  assert(rows[1].fieldEquals(0, '"q"'));
});
