/**
 * Claims about writing rows: what toCsv, toTsv and toRecord write reads back
 * as the same rows, from string arrays and LazyRows alike.
 */

import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  fromCsvToLazyRows,
  fromCsvToRows,
  fromRecordToRows,
  fromTsvToRows,
  LazyRow,
  toCsv,
  toRecord,
  toTsv,
} from "../../src/transforms/mod.ts";
import { chunked, readCsvReference } from "./reference.ts";

/** Seeded rows of awkward fields: quotes, separators, line ends, UTF-8. */
function randomRows(count: number, pieces: string[]): string[][] {
  let seed = 7;
  const random = (n: number) =>
    (seed = (seed * 1103515245 + 12345) % 2 ** 31) % n;
  return Array.from(
    { length: count },
    () =>
      Array.from(
        { length: 1 + random(6) },
        () =>
          Array.from({ length: random(5) }, () => pieces[random(pieces.length)])
            .join(""),
      ),
  );
}

const PIECES = [
  "a",
  "word",
  " ",
  ",",
  ";",
  '"',
  "\n",
  "\r",
  "\r\n",
  "é",
  "🎉",
  "東京",
  "\t",
  "\x1E",
];

async function bytesOf(chunks: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const parts = await enumerate(chunks).collect();
  return new Uint8Array(parts.flatMap((part) => [...part]));
}

Deno.test("CSV written by toCsv reads back as the same rows, with any separator and line end.", async () => {
  const rows = randomRows(2000, PIECES);
  for (
    const options of [{}, { separator: ";" }, { separator: "\t", crlf: true }]
  ) {
    const csv = await bytesOf(enumerate([rows]).transform(toCsv(options)));
    const back = await enumerate(chunked(csv, 1000))
      .transform(fromCsvToRows(options)).flatten().collect();
    assertEquals(back, rows, JSON.stringify(options));
    assertEquals(
      readCsvReference(new TextDecoder().decode(csv), options.separator),
      rows,
    );
  }
});

Deno.test("A CSV row of one empty field survives the round trip.", async () => {
  const rows = [["a"], [""], ["b"]];
  const csv = await bytesOf(enumerate([rows]).transform(toCsv()));
  assertEquals(new TextDecoder().decode(csv), 'a\n""\nb\n');
  assertEquals(
    await enumerate([csv]).transform(fromCsvToRows()).flatten().collect(),
    rows,
  );
});

Deno.test("TSV written by toTsv reads back as the same rows.", async () => {
  // TSV can't hold a tab, LF or CR in a field, nor a row of one empty field.
  const rows = randomRows(2000, PIECES.filter((p) => !/[\t\n\r]/.test(p)))
    .filter((row) => !(row.length === 1 && row[0] === ""));
  const tsv = await bytesOf(enumerate([rows]).transform(toTsv()));
  assertEquals(
    await enumerate(chunked(tsv, 1000)).transform(fromTsvToRows()).flatten()
      .collect(),
    rows,
  );
});

Deno.test("Record format written by toRecord reads back as the same rows.", async () => {
  const rows = randomRows(2000, PIECES.filter((p) => p !== "\x1E"));
  const record = await bytesOf(enumerate([rows]).transform(toRecord()));
  assertEquals(
    await enumerate(chunked(record, 1000)).transform(fromRecordToRows())
      .flatten().collect(),
    rows,
  );
});

Deno.test("Writers give the same bytes for LazyRows as for the string arrays they hold.", async () => {
  const rows = randomRows(
    500,
    PIECES.filter((p) => !/[\t\n\r]/.test(p) && p !== "\x1E"),
  )
    .filter((row) => !(row.length === 1 && row[0] === ""));
  const csv = await bytesOf(enumerate([rows]).transform(toCsv()));
  const lazy = await enumerate([csv]).transform(fromCsvToLazyRows()).collect();
  const fromStrings = rows.map((row) => LazyRow.fromStringArray(row));

  for (const writer of [toCsv, toTsv, toRecord]) {
    const expected = await bytesOf(enumerate([rows]).transform(writer()));
    assertEquals(await bytesOf(enumerate(lazy).transform(writer())), expected);
    assertEquals(
      await bytesOf(enumerate(fromStrings).transform(writer())),
      expected,
    );
  }
});
