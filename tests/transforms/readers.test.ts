/**
 * Claims about reading CSV and TSV: the WebAssembly reader gives the same rows
 * as the plain TypeScript reference, wherever the chunks are cut, through
 * every way of getting rows out.
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  fromCsvToLazyRows,
  fromCsvToRows,
  fromTsvToLazyRows,
  fromTsvToRows,
  type LazyRow,
} from "../../src/transforms/mod.ts";
import { batchRows } from "../../src/transforms/common.ts";
import { lazyRows } from "../../src/transforms/lazy-row.ts";
import { readRows } from "../../src/wasm/flatdata.ts";
import {
  CHUNK_SIZES,
  chunked,
  EDGE_CSV,
  EDGE_TSV,
  readCsvReference,
  readTsvReference,
} from "./reference.ts";

const encoder = new TextEncoder();
const COMMA = 0x2C;
const TAB = 0x09;

/** Rows read by the WASM reader with `size`-byte chunks on both sides. */
async function readAt(
  text: string,
  size: number,
  separator: number,
  quoting: boolean,
) {
  const strings: string[][] = [];
  const lazy: LazyRow[] = [];
  const source = enumerate(chunked(encoder.encode(text), size));
  for await (const batch of readRows(source, separator, quoting, size)) {
    strings.push(...batchRows(batch));
    lazy.push(...lazyRows(batch));
  }
  return { strings, lazy };
}

/** Every way to read a LazyRow agrees with the expected fields. */
function assertLazyRow(row: LazyRow, expected: string[], what: string) {
  assertEquals(row.columnCount, expected.length, what);
  assertEquals(row.toStringArray(), expected, what);
  for (let i = 0; i < expected.length; i++) {
    assertEquals(row.getField(i), expected[i], what);
    assert(row.fieldEquals(i, expected[i]), what);
    assert(!row.fieldEquals(i, expected[i] + "x"), what);
  }
}

Deno.test("The CSV reader matches the reference on every edge case at every chunk size.", async () => {
  for (const [i, text] of EDGE_CSV.entries()) {
    const expected = readCsvReference(text);
    for (const size of CHUNK_SIZES) {
      const what = `fixture ${i}, chunks of ${size}`;
      const { strings, lazy } = await readAt(text, size, COMMA, true);
      assertEquals(strings, expected, what);
      assertEquals(lazy.length, expected.length, what);
      lazy.forEach((row, r) => assertLazyRow(row, expected[r], what));
    }
  }
});

Deno.test("The CSV reader matches the reference with other separators.", async () => {
  for (const separator of [";", "|", "\t", "\x1F"]) {
    for (const [i, text] of EDGE_CSV.entries()) {
      const input = text.replaceAll(",", separator);
      const expected = readCsvReference(input, separator);
      for (const size of [1, 64, 1000]) {
        const { strings } = await readAt(
          input,
          size,
          separator.charCodeAt(0),
          true,
        );
        assertEquals(strings, expected, `${separator} ${i} ${size}`);
      }
    }
  }
});

Deno.test("The TSV reader matches the reference on every edge case at every chunk size.", async () => {
  for (const [i, text] of EDGE_TSV.entries()) {
    const expected = readTsvReference(text);
    for (const size of CHUNK_SIZES) {
      const what = `fixture ${i}, chunks of ${size}`;
      const { strings, lazy } = await readAt(text, size, TAB, false);
      assertEquals(strings, expected, what);
      assertEquals(lazy.length, expected.length, what);
      lazy.forEach((row, r) => assertLazyRow(row, expected[r], what));
    }
  }
});

Deno.test("The public CSV and TSV readers match the reference, however the source is chunked.", async () => {
  const csv = EDGE_CSV.join("\n");
  const tsv = EDGE_TSV.join("\n");
  for (const size of [1, 3, 4096]) {
    const csvSource = () => enumerate(chunked(encoder.encode(csv), size));
    const tsvSource = () => enumerate(chunked(encoder.encode(tsv), size));
    assertEquals(
      await csvSource().transform(fromCsvToRows()).flatten().collect(),
      readCsvReference(csv),
    );
    assertEquals(
      await csvSource().transform(fromCsvToLazyRows()).flatten()
        .map((row) => row.toStringArray()).collect(),
      readCsvReference(csv),
    );
    assertEquals(
      await tsvSource().transform(fromTsvToRows()).flatten().collect(),
      readTsvReference(tsv),
    );
    assertEquals(
      await tsvSource().transform(fromTsvToLazyRows()).flatten()
        .map((row) => row.toStringArray()).collect(),
      readTsvReference(tsv),
    );
  }
});

Deno.test("A character split across chunks is read whole.", async () => {
  // Every split point of every multi-byte character, in a field and next to
  // a separator, at the chunk sizes that move it around.
  const text = 'é,東京,🎉🎉\n"🎉",x🎉,東\n';
  const expected = readCsvReference(text);
  for (let size = 1; size <= 12; size++) {
    const { strings, lazy } = await readAt(text, size, COMMA, true);
    assertEquals(strings, expected, `chunks of ${size}`);
    lazy.forEach((row, r) => assertLazyRow(row, expected[r], `${size}`));
  }
});

Deno.test("A field of several megabytes is read whole, quoted or not.", async () => {
  // Several times the 128 KB buffers, with every special character inside.
  const big = 'say "東京", then\nnew line 🎉\r\n'.repeat(150_000);
  const plain = "x".repeat(5_000_000);
  const csv = `a,"${big.replaceAll('"', '""')}",b\n${plain},c\nlast,row\n`;
  const expected = [["a", big, "b"], [plain, "c"], ["last", "row"]];

  const source = () => enumerate(chunked(encoder.encode(csv), 65536));
  assertEquals(
    await source().transform(fromCsvToRows()).flatten().collect(),
    expected,
  );
  const lazy = await source().transform(fromCsvToLazyRows()).flatten()
    .collect();
  lazy.forEach((row, r) => assertLazyRow(row, expected[r], `row ${r}`));

  const tsv = `a\t${plain}\tb\n`;
  assertEquals(
    await enumerate([encoder.encode(tsv)]).transform(fromTsvToRows())
      .flatten().collect(),
    [["a", plain, "b"]],
  );
});

Deno.test("A byte order mark at the start is dropped, even split across chunks.", async () => {
  const text = "﻿a,b\nc,d\n";
  for (const size of [1, 2, 3, 1000]) {
    const source = () => enumerate(chunked(encoder.encode(text), size));
    assertEquals(
      await source().transform(fromCsvToRows()).flatten().collect(),
      [["a", "b"], ["c", "d"]],
    );
    assertEquals(
      await source().transform(fromTsvToRows()).flatten().collect(),
      [["a,b"], ["c,d"]],
    );
  }
});

Deno.test("A U+FEFF after the start is content, even at the start of a batch.", async () => {
  const { strings } = await readAt("a\n﻿b\n", 2, COMMA, true);
  assertEquals(strings, [["a"], ["﻿b"]]);
});

Deno.test("Invalid UTF-8 is an error.", async () => {
  const invalid = new Uint8Array([0x61, 0x2C, 0xFF, 0x0A]);
  await assertRejects(
    () => enumerate([invalid]).transform(fromCsvToRows()).collect(),
    TypeError,
  );
  await assertRejects(
    () => enumerate([invalid]).transform(fromTsvToRows()).collect(),
    TypeError,
  );
});

Deno.test("Separate streams read at the same time don't mix.", async () => {
  async function* slowly(text: string) {
    for (const chunk of chunked(encoder.encode(text), 3)) {
      await new Promise((r) => setTimeout(r, 1));
      yield chunk;
    }
  }
  const [a, b] = await Promise.all([
    enumerate(slowly("a,é\n1,2\n")).transform(fromCsvToRows()).flatten()
      .collect(),
    enumerate(slowly("b;🎉\n3;4\n")).transform(
      fromCsvToRows({ separator: ";" }),
    )
      .flatten().collect(),
  ]);
  assertEquals(a, [["a", "é"], ["1", "2"]]);
  assertEquals(b, [["b", "🎉"], ["3", "4"]]);
});
