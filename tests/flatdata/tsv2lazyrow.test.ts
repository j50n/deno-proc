/**
 * Comprehensive test suite for tsv2lazyrow transformation.
 * Tests lazyrow binary encoding from TSV.
 */

import { assertEquals } from "@std/assert";
import { FlatdataProcessor } from "../../src/wasm/flatdata-processor.ts";

async function tsv2lazyrow(input: string): Promise<Uint8Array> {
  const processor = await FlatdataProcessor.create();
  const encoder = new TextEncoder();

  const chunks: Uint8Array[] = [];
  for await (
    const chunk of processor.tsvToLazyRow(
      (async function* () {
        yield encoder.encode(input);
      })(),
    )
  ) {
    chunks.push(chunk);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// Helper to decode lazyrow binary format
function decodeLazyrow(data: Uint8Array): string[][] {
  const rows: string[][] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset < data.length) {
    // Read row_length
    const _rowLength = view.getUint32(offset, true);
    offset += 4;

    // Read field_count
    const fieldCount = view.getUint32(offset, true);
    offset += 4;

    // Read field lengths
    const fieldLengths: number[] = [];
    for (let i = 0; i < fieldCount; i++) {
      fieldLengths.push(view.getUint32(offset, true));
      offset += 4;
    }

    // Read field data
    const fields: string[] = [];
    for (const len of fieldLengths) {
      const fieldData = data.slice(offset, offset + len);
      fields.push(new TextDecoder().decode(fieldData));
      offset += len;
    }

    rows.push(fields);
  }

  return rows;
}

// Basic functionality tests
Deno.test("tsv2lazyrow - basic conversion", async () => {
  const result = await tsv2lazyrow("a\tb\tc\n1\t2\t3\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "b", "c"], ["1", "2", "3"]]);
});

Deno.test("tsv2lazyrow - empty fields", async () => {
  const result = await tsv2lazyrow("a\t\tc\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "", "c"]]);
});

Deno.test("tsv2lazyrow - single field", async () => {
  const result = await tsv2lazyrow("value\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["value"]]);
});

Deno.test("tsv2lazyrow - single record multiple fields", async () => {
  const result = await tsv2lazyrow("a\tb\tc\td\te\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "b", "c", "d", "e"]]);
});

Deno.test("tsv2lazyrow - multiple records", async () => {
  const result = await tsv2lazyrow("a\tb\n1\t2\n3\t4\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "b"], ["1", "2"], ["3", "4"]]);
});

// Edge cases
Deno.test("tsv2lazyrow - empty input", async () => {
  const result = await tsv2lazyrow("");
  const rows = decodeLazyrow(result);
  assertEquals(rows, []);
});

Deno.test("tsv2lazyrow - only tab", async () => {
  const result = await tsv2lazyrow("\t\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["", ""]]);
});

Deno.test("tsv2lazyrow - only newline", async () => {
  const result = await tsv2lazyrow("\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [[""]]);
});

Deno.test("tsv2lazyrow - consecutive tabs", async () => {
  const result = await tsv2lazyrow("a\t\t\tb\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "", "", "b"]]);
});

Deno.test("tsv2lazyrow - consecutive newlines", async () => {
  const result = await tsv2lazyrow("a\n\n\nb\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a"], [""], [""], ["b"]]);
});

// Carriage return handling
Deno.test("tsv2lazyrow - strips \\r from \\r\\n", async () => {
  const result = await tsv2lazyrow("a\tb\r\n1\t2\r\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "b"], ["1", "2"]]);
});

Deno.test("tsv2lazyrow - strips standalone \\r", async () => {
  const result = await tsv2lazyrow("a\rb\tc\r\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["ab", "c"]]);
});

Deno.test("tsv2lazyrow - strips multiple \\r", async () => {
  const result = await tsv2lazyrow("a\r\r\rb\tc\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["ab", "c"]]);
});

// Special characters
Deno.test("tsv2lazyrow - unicode characters", async () => {
  const result = await tsv2lazyrow("hello\t世界\témoji🎉\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["hello", "世界", "émoji🎉"]]);
});

Deno.test("tsv2lazyrow - special ASCII characters", async () => {
  const result = await tsv2lazyrow("a@#$\tb%^&\tc*()\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a@#$", "b%^&", "c*()"]]);
});

Deno.test("tsv2lazyrow - quotes and commas (preserved)", async () => {
  const result = await tsv2lazyrow("a\"b\tc,d\te'f\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [['a"b', "c,d", "e'f"]]);
});

Deno.test("tsv2lazyrow - null bytes", async () => {
  const result = await tsv2lazyrow("a\x00b\tc\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a\x00b", "c"]]);
});

// Pathological cases
Deno.test("tsv2lazyrow - very long field (10K chars)", async () => {
  const longField = "x".repeat(10000);
  const result = await tsv2lazyrow(`${longField}\tb\n`);
  const rows = decodeLazyrow(result);
  assertEquals(rows, [[longField, "b"]]);
});

Deno.test("tsv2lazyrow - many fields (1000 fields)", async () => {
  const fields = Array.from({ length: 1000 }, (_, i) => `f${i}`);
  const result = await tsv2lazyrow(fields.join("\t") + "\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].length, 1000);
  assertEquals(rows[0], fields);
});

Deno.test("tsv2lazyrow - many records (5000 records)", async () => {
  const records = Array.from({ length: 5000 }, (_, i) => `a${i}\tb${i}`);
  const input = records.join("\n") + "\n";
  const result = await tsv2lazyrow(input);
  const rows = decodeLazyrow(result);
  assertEquals(rows.length, 5000);
  for (let i = 0; i < 5000; i++) {
    assertEquals(rows[i], [`a${i}`, `b${i}`]);
  }
});

Deno.test("tsv2lazyrow - mixed line endings", async () => {
  const result = await tsv2lazyrow("a\tb\r\nc\td\ne\tf\r\n");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "b"], ["c", "d"], ["e", "f"]]);
});

// No trailing newline
Deno.test("tsv2lazyrow - no trailing newline", async () => {
  const result = await tsv2lazyrow("a\tb\tc");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "b", "c"]]);
});

Deno.test("tsv2lazyrow - multiple records no trailing newline", async () => {
  const result = await tsv2lazyrow("a\tb\n1\t2");
  const rows = decodeLazyrow(result);
  assertEquals(rows, [["a", "b"], ["1", "2"]]);
});

// Binary format validation
Deno.test("tsv2lazyrow - binary format structure", async () => {
  const result = await tsv2lazyrow("ab\tcd\n");
  const view = new DataView(
    result.buffer,
    result.byteOffset,
    result.byteLength,
  );

  // Row length (4 + 4*2 + 2 + 2 = 16 bytes)
  // Format: field_count (4) + field_lengths (4*2) + field_data (2+2)
  assertEquals(view.getUint32(0, true), 16);

  // Field count
  assertEquals(view.getUint32(4, true), 2);

  // Field lengths
  assertEquals(view.getUint32(8, true), 2); // "ab"
  assertEquals(view.getUint32(12, true), 2); // "cd"

  // Field data
  assertEquals(new TextDecoder().decode(result.slice(16, 18)), "ab");
  assertEquals(new TextDecoder().decode(result.slice(18, 20)), "cd");
});

// Round-trip through lazyrow2record
Deno.test("tsv2lazyrow - round-trip to record format", async () => {
  const processor = await FlatdataProcessor.create();
  const input = "a\tb\tc\n1\t2\t3\n";

  // TSV → lazyrow
  const lazyrow = await tsv2lazyrow(input);

  // lazyrow → record
  const chunks: Uint8Array[] = [];
  for await (
    const chunk of processor.lazyRowBinaryToRecordStreaming(
      (async function* () {
        yield lazyrow;
      })(),
    )
  ) {
    chunks.push(chunk);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  const record = new TextDecoder().decode(result);
  assertEquals(record, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});
