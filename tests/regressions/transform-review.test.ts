import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { enumerate, toBytes, toLines } from "../../mod.ts";
import {
  fromCsvToLazyRows,
  fromCsvToRows,
  fromJsonToRows,
  fromRecordToRows,
  fromTsvToRows,
  LazyRow,
  toCsv,
  toRecord,
  toTsv,
} from "../../src/transforms/mod.ts";

const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text);

async function text(chunks: AsyncIterable<Uint8Array>): Promise<string> {
  const parts = await enumerate(chunks).collect();
  return new TextDecoder().decode(
    new Uint8Array(parts.flatMap((part) => [...part])),
  );
}

/** Rows parsed from CSV: LazyRows over the reader's bytes, as real pipelines get them. */
function csvRows(csv: string) {
  return enumerate([bytes(csv)]).transform(fromCsvToLazyRows());
}

// Fields that a format can't hold must be refused, never written raw, or one
// row turns into several downstream.

Deno.test("toTsv refuses a CSV field holding a newline, from LazyRows.", async () => {
  await assertRejects(
    () => text(csvRows('"a\nb",c\n').transform(toTsv())),
    Error,
    "Invalid character (LF) in TSV data at row 1, field 1",
  );
});

Deno.test("toTsv refuses a CSV field holding a tab, from LazyRows.", async () => {
  await assertRejects(
    () => text(csvRows('x,y\n"t\tu",v\n').transform(toTsv())),
    Error,
    "Invalid character (tab) in TSV data at row 2, field 1",
  );
});

Deno.test("toRecord refuses fields holding a record or field separator, on every path.", async () => {
  type Rows = AsyncIterable<string[] | string[][] | LazyRow | LazyRow[]>;
  const inputs: [string, () => Rows][] = [
    ["Row", () => enumerate([["a\x1Fb"]])],
    ["Row[]", () => enumerate([[["ok"], ["a\x1Eb"]]])],
    ["string LazyRow", () => enumerate([LazyRow.fromStringArray(["a\x1Eb"])])],
    ["CSV LazyRow[]", () => csvRows("a\x1Fb\n")],
  ];
  for (const [kind, input] of inputs) {
    await assertRejects(
      () => text(enumerate(input()).transform(toRecord())),
      Error,
      "in record data",
      kind,
    );
  }
});

Deno.test("toCsv keeps a field holding \\x1E or \\x1F as one field of one row.", async () => {
  const row = ["x\x1Ey", "p\x1Fq", "z"];
  const inputs: (string[] | string[][] | LazyRow)[][] = [
    [row],
    [[row]],
    [LazyRow.fromStringArray(row)],
  ];
  for (const input of inputs) {
    const csv = await text(enumerate(input).transform(toCsv()));
    const back = await enumerate([bytes(csv)]).transform(fromCsvToRows())
      .flatten().collect();
    assertEquals(back, [row]);
  }
});

Deno.test("toCsv handles a stream whose items change type.", async () => {
  const csv = await text(
    enumerate<string[] | LazyRow[]>([
      ["a", "b"],
      [LazyRow.fromStringArray(["c", "d"])],
    ]).transform(toCsv()),
  );
  assertEquals(csv, "a,b\nc,d\n");
});

// Each stream decodes on its own: a character split across chunks in one
// stream must not be mixed up with another stream's.

async function* splitE(tag: string, end: string) {
  yield new Uint8Array([...bytes(tag), 0xC3]);
  await new Promise((r) => setTimeout(r, 10));
  yield new Uint8Array([0xA9, ...bytes(end)]);
}

Deno.test("Concurrent TSV, record, and JSON streams each decode split characters correctly.", async () => {
  const [tsvA, tsvB, recA, jsonB] = await Promise.all([
    enumerate(splitE("A", "\n")).transform(fromTsvToRows()).flatten().collect(),
    enumerate(splitE("B", "\n")).transform(fromTsvToRows()).flatten().collect(),
    enumerate(splitE("C", "\x1E")).transform(fromRecordToRows()).flatten()
      .collect(),
    enumerate(splitE('"D', '"\n')).transform(fromJsonToRows()).flatten()
      .collect(),
  ]);
  assertEquals([tsvA, tsvB, recA, jsonB], [
    [["Aé"]],
    [["Bé"]],
    [["Cé"]],
    ["Dé"],
  ]);
});

Deno.test("toLines drops the CR of a CRLF split across two chunks.", async () => {
  const lines = await enumerate([bytes("a\r"), bytes("\nb\r\n")])
    .transform(toLines).collect();
  assertEquals(lines, ["a", "b"]);
});

Deno.test("fromTsvToRows keeps a row of empty fields.", async () => {
  const rows = await enumerate([bytes("a\tb\n\t\n")]).transform(fromTsvToRows())
    .flatten().collect();
  assertEquals(rows, [["a", "b"], ["", ""]]);
});

Deno.test("fromTsvToRows reads a CRLF file the same as an LF file.", async () => {
  const rows = await enumerate([bytes("a\tb\r\nc\td\r\n")])
    .transform(fromTsvToRows()).flatten().collect();
  assertEquals(rows, [["a", "b"], ["c", "d"]]);
});

Deno.test("A record holding one empty field round-trips.", async () => {
  const back = await enumerate([bytes(
    await text(enumerate([[["x"], [""], ["y"]]]).transform(toRecord())),
  )]).transform(fromRecordToRows()).flatten().collect();
  assertEquals(back, [["x"], [""], ["y"]]);
});

Deno.test("A very long TSV line in many small chunks is read in linear time.", async () => {
  const line = "x".repeat(2_000_000);
  const encoded = bytes(line + "\n");
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < encoded.length; i += 512) {
    chunks.push(encoded.subarray(i, i + 512));
  }
  const start = performance.now();
  const rows = await enumerate(chunks).transform(fromTsvToRows()).flatten()
    .collect();
  const ms = performance.now() - start;

  assertEquals(rows[0][0].length, line.length);
  // Re-splitting the growing line on every chunk takes seconds here.
  if (ms > 1500) throw new Error(`took ${ms.toFixed(0)} ms`);
});

Deno.test("toBytes handles a stream whose items change type.", async () => {
  const out = await text(
    enumerate<string | Uint8Array>(["a", bytes("b\n"), "c"]).transform(toBytes),
  );
  assertEquals(out, "a\nb\nc\n");
});

Deno.test("CSV separators that CSV can't use are refused up front.", () => {
  for (const separator of ['"', "\n", "\r", "ab", "é", ""]) {
    assertThrows(() => toCsv({ separator }), RangeError);
    assertThrows(() => fromCsvToRows({ separator }), RangeError);
  }
  toCsv({ separator: ";" });
});
