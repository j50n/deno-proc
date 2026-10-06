/**
 * Claims about csvToTsv and tsvToCsv, which convert bytes to bytes in
 * WebAssembly: they give what reading with the reference and writing with
 * the reference gives, wherever the chunks are cut.
 */

import { assertEquals, assertRejects } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  csvToTsv,
  fromCsvToRows,
  fromTsvToRows,
  toCsv,
  tsvToCsv,
} from "../../src/transforms/mod.ts";
import { convertCsvToTsv, convertTsvToCsv } from "../../src/wasm/flatdata.ts";
import {
  CHUNK_SIZES,
  chunked,
  EDGE_CSV,
  EDGE_TSV,
  readCsvReference,
  readTsvReference,
  rowsOrError,
  writeCsvReference,
  writeTsvReference,
} from "./reference.ts";

const encoder = new TextEncoder();

async function text(chunks: AsyncIterable<Uint8Array>): Promise<string> {
  let out = "";
  const streaming = new TextDecoder();
  for await (const chunk of chunks) {
    out += streaming.decode(chunk, { stream: true });
  }
  return out + streaming.decode();
}

const source = (input: string, size: number) =>
  enumerate(chunked(encoder.encode(input), size));

/** The edge-case TSV inputs that the reference reads without an error. */
const READABLE_TSV = EDGE_TSV.filter((tsv) =>
  typeof rowsOrError(() => readTsvReference(tsv)) !== "string"
);

/** The first field TSV can't hold, as csvToTsv reports it. */
function firstInvalid(rows: string[][]): string | undefined {
  const names: Record<string, string> = { "\t": "tab", "\n": "LF", "\r": "CR" };
  for (const [r, row] of rows.entries()) {
    for (const [f, field] of row.entries()) {
      const bad = /[\t\n\r]/.exec(field);
      if (bad) {
        return `Invalid character (${names[bad[0]]}) in TSV data at row ${
          r + 1
        }, field ${f + 1}`;
      }
    }
  }
}

Deno.test("csvToTsv writes the reference's rows as TSV, or refuses as the reference says, at every chunk size.", async () => {
  // No fixture with a CR the reference refuses has a field TSV can't hold
  // before it, so the reference's error is the first one.
  for (const [i, csv] of EDGE_CSV.entries()) {
    const rows = rowsOrError(() => readCsvReference(csv));
    const invalid = typeof rows === "string" ? rows : firstInvalid(rows);
    for (const size of CHUNK_SIZES) {
      const converted = () =>
        text(convertCsvToTsv(source(csv, size), 0x2C, size));
      const what = `fixture ${i}, chunks of ${size}`;
      if (typeof rows === "string" || invalid) {
        await assertRejects(converted, Error, invalid, what);
      } else {
        assertEquals(await converted(), writeTsvReference(rows), what);
      }
    }
  }
});

Deno.test("csvToTsv converts CSV whose fields TSV can hold, with any separator.", async () => {
  const csv = 'name;note\n"Smith; J";"said ""hi"""\r\n;\nü;🎉\n';
  const tsv = await text(
    source(csv, 5).transform(csvToTsv({ separator: ";" })),
  );
  assertEquals(tsv, 'name\tnote\nSmith; J\tsaid "hi"\n\t\nü\t🎉\n');
});

Deno.test("csvToTsv names the row and field of a character TSV can't hold.", async () => {
  await assertRejects(
    () => text(source('a,b\nc,"d\ne"\n', 100).transform(csvToTsv())),
    Error,
    "Invalid character (LF) in TSV data at row 2, field 2",
  );
  await assertRejects(
    () => text(source("a\tb,c\n", 100).transform(csvToTsv())),
    Error,
    "Invalid character (tab) in TSV data at row 1, field 1",
  );
});

Deno.test("csvToTsv reports whichever refusal comes first: a CR in the CSV, or a byte TSV can't hold.", async () => {
  const cases = [
    ['"a\tb"\rc\n', "Invalid character (tab) in TSV data at row 1, field 1"],
    ['a\rb,"c\td"\n', "Invalid character (CR) in CSV data at row 1, field 1"],
    ['"a\r"\rb\n', "Invalid character (CR) in TSV data at row 1, field 1"],
    ['a,"b"\rc\n', "Invalid character (CR) in CSV data at row 1, field 2"],
  ];
  for (const [csv, message] of cases) {
    for (const size of CHUNK_SIZES) {
      await assertRejects(
        () => text(convertCsvToTsv(source(csv, size), 0x2C, size)),
        Error,
        message,
        `${JSON.stringify(csv)}, chunks of ${size}`,
      );
    }
  }
});

Deno.test("tsvToCsv writes the reference's rows as CSV, or refuses as the reference says, at every chunk size.", async () => {
  for (const [i, tsv] of EDGE_TSV.entries()) {
    const rows = rowsOrError(() => readTsvReference(tsv));
    for (const size of CHUNK_SIZES) {
      const converted = () =>
        text(convertTsvToCsv(source(tsv, size), 0x2C, false, size));
      const what = `fixture ${i}, chunks of ${size}`;
      if (typeof rows === "string") {
        await assertRejects(converted, Error, rows, what);
      } else {
        assertEquals(await converted(), writeCsvReference(rows), what);
      }
    }
  }
});

Deno.test("tsvToCsv takes a separator and CRLF line ends as toCsv does.", async () => {
  for (const options of [{ separator: ";" }, { crlf: true }, {}]) {
    for (const [i, tsv] of READABLE_TSV.entries()) {
      const rows = readTsvReference(tsv);
      const viaRows = await text(enumerate([rows]).transform(toCsv(options)));
      const direct = await text(source(tsv, 7).transform(tsvToCsv(options)));
      assertEquals(direct, viaRows, `${JSON.stringify(options)} ${i}`);
    }
  }
});

Deno.test("A field of several megabytes converts whole, both ways.", async () => {
  const big = 'say "東京", then 🎉 '.repeat(300_000);
  const tsv = `a\t${big}\tb\nc\td\n`;
  const csv = await text(source(tsv, 65536).transform(tsvToCsv()));
  assertEquals(csv, `a,"${big.replaceAll('"', '""')}",b\nc,d\n`);
  assertEquals(await text(source(csv, 65536).transform(csvToTsv())), tsv);
});

Deno.test("TSV to CSV and back gives the same rows.", async () => {
  const tsv = READABLE_TSV.join("\n");
  const csv = await text(source(tsv, 64).transform(tsvToCsv()));
  assertEquals(
    await source(csv, 64).transform(fromCsvToRows()).flatten().collect(),
    await source(tsv, 64).transform(fromTsvToRows()).flatten().collect(),
  );
  assertEquals(
    await text(source(csv, 64).transform(csvToTsv())),
    writeTsvReference(readTsvReference(tsv)),
  );
});
