/**
 * Comprehensive test suite for record2tsv transformation.
 */

import { assertEquals } from "@std/assert";
import { FlatdataProcessor } from "../../src/wasm/flatdata-processor.ts";

async function record2tsv(input: string): Promise<string> {
  const processor = await FlatdataProcessor.create();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const chunks: Uint8Array[] = [];
  for await (
    const chunk of processor.recordToTsv(
      (async function* () {
        yield encoder.encode(input);
      })(),
    )
  ) {
    chunks.push(chunk);
  }

  return decoder.decode(
    new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0)).map((_, i) => {
      let offset = 0;
      for (const chunk of chunks) {
        if (i < offset + chunk.length) return chunk[i - offset];
        offset += chunk.length;
      }
      return 0;
    }),
  );
}

// Basic functionality tests
Deno.test("record2tsv - basic conversion", async () => {
  const result = await record2tsv("a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
  assertEquals(result, "a\tb\tc\n1\t2\t3\n");
});

Deno.test("record2tsv - empty fields", async () => {
  const input = "a\x1F\x1Fc\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\t\tc\n");
});

Deno.test("record2tsv - single field", async () => {
  const input = "value\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "value\n");
});

Deno.test("record2tsv - single record multiple fields", async () => {
  const input = "a\x1Fb\x1Fc\x1Fd\x1Fe\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\tb\tc\td\te\n");
});

Deno.test("record2tsv - multiple records", async () => {
  const input = "a\x1Fb\x1E1\x1F2\x1E3\x1F4\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\tb\n1\t2\n3\t4\n");
});

// Edge cases
Deno.test("record2tsv - empty input", async () => {
  const input = "";
  const result = await record2tsv(input);
  assertEquals(result, "");
});

Deno.test("record2tsv - only field separator", async () => {
  const input = "\x1F\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "\t\n");
});

Deno.test("record2tsv - only record separator", async () => {
  const input = "\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "\n");
});

Deno.test("record2tsv - consecutive field separators", async () => {
  const input = "a\x1F\x1F\x1Fb\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\t\t\tb\n");
});

Deno.test("record2tsv - consecutive record separators", async () => {
  const input = "a\x1E\x1E\x1Eb\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\n\n\nb\n");
});

// Special characters
Deno.test("record2tsv - ASCII printable characters", async () => {
  const input = "hello\x1Fworld!\x1F@#$%^&*()\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "hello\tworld!\t@#$%^&*()\n");
});

Deno.test("record2tsv - Unicode characters", async () => {
  const input = "café\x1F日本語\x1F🎉\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "café\t日本語\t🎉\n");
});

Deno.test("record2tsv - spaces and punctuation", async () => {
  const input = "hello world\x1Ffoo, bar\x1Fbaz; qux\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "hello world\tfoo, bar\tbaz; qux\n");
});

Deno.test("record2tsv - quotes and backslashes", async () => {
  const input = "a\"b\x1Fc\\d\x1Fe'f\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\"b\tc\\d\te'f\n");
});

// Pathological cases
Deno.test("record2tsv - very long field", async () => {
  const longField = "x".repeat(10000);
  const input = `${longField}\x1Fb\x1E`;
  const result = await record2tsv(input);
  assertEquals(result, `${longField}\tb\n`);
});

Deno.test("record2tsv - many fields", async () => {
  const fields = Array.from({ length: 1000 }, (_, i) => `f${i}`);
  const input = fields.join("\x1F") + "\x1E";
  const result = await record2tsv(input);
  assertEquals(result, fields.join("\t") + "\n");
});

Deno.test("record2tsv - many records", async () => {
  const records = Array.from({ length: 1000 }, (_, i) => `a${i}\x1Fb${i}`);
  const input = records.join("\x1E") + "\x1E";
  const result = await record2tsv(input);
  const expected = records.map((r) => r.replace("\x1F", "\t")).join("\n") +
    "\n";
  assertEquals(result, expected);
});

Deno.test("record2tsv - alternating separators", async () => {
  const input = "a\x1F\x1Eb\x1E\x1Fc\x1F\x1Ed\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\t\nb\n\tc\t\nd\n");
});

Deno.test("record2tsv - all ASCII control chars except separators", async () => {
  // Test that other control characters pass through unchanged
  const input = "a\x01b\x02c\x03d\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\x01b\x02c\x03d\n");
});

Deno.test("record2tsv - null bytes", async () => {
  const input = "a\x00b\x1Fc\x00d\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\x00b\tc\x00d\n");
});

Deno.test("record2tsv - high byte values", async () => {
  const input = "a\xFFb\x1Fc\xFEd\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a\xFFb\tc\xFEd\n");
});

// Boundary alignment tests
Deno.test("record2tsv - 15 byte input", async () => {
  const input = "a".repeat(14) + "\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a".repeat(14) + "\n");
});

Deno.test("record2tsv - 16 byte input", async () => {
  const input = "a".repeat(15) + "\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a".repeat(15) + "\n");
});

Deno.test("record2tsv - 17 byte input", async () => {
  const input = "a".repeat(16) + "\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a".repeat(16) + "\n");
});

Deno.test("record2tsv - 32 byte input", async () => {
  const input = "a".repeat(31) + "\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a".repeat(31) + "\n");
});

Deno.test("record2tsv - separators at 16-byte boundaries", async () => {
  const input = "a".repeat(15) + "\x1F" + "b".repeat(15) + "\x1E";
  const result = await record2tsv(input);
  assertEquals(result, "a".repeat(15) + "\t" + "b".repeat(15) + "\n");
});

Deno.test("record2tsv - mixed separators across boundaries", async () => {
  const input = "a".repeat(8) + "\x1F" + "b".repeat(7) + "\x1E" +
    "c".repeat(8) + "\x1F" + "d".repeat(7) + "\x1E";
  const result = await record2tsv(input);
  assertEquals(
    result,
    "a".repeat(8) + "\t" + "b".repeat(7) + "\n" + "c".repeat(8) + "\t" +
      "d".repeat(7) + "\n",
  );
});
