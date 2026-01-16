/**
 * Comprehensive test suite for record2tsv transformation.
 * Tests both SIMD and scalar implementations for correctness and equivalence.
 */

import { assertEquals } from "@std/assert";
import { FlatdataProcessor } from "../../src/wasm/flatdata-processor.ts";

async function record2tsv(
  input: string,
  forceScalar = false,
): Promise<string> {
  const processor = await FlatdataProcessor.create(forceScalar);
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
Deno.test("record2tsv SIMD - basic conversion", async () => {
  const result = await record2tsv("a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E", false);
  assertEquals(result, "a\tb\tc\n1\t2\t3\n");
});

Deno.test("record2tsv scalar - basic conversion", async () => {
  const result = await record2tsv("a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E", true);
  assertEquals(result, "a\tb\tc\n1\t2\t3\n");
});

Deno.test("record2tsv - empty fields", async () => {
  const input = "a\x1F\x1Fc\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\t\tc\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - single field", async () => {
  const input = "value\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "value\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - single record multiple fields", async () => {
  const input = "a\x1Fb\x1Fc\x1Fd\x1Fe\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\tb\tc\td\te\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - multiple records", async () => {
  const input = "a\x1Fb\x1E1\x1F2\x1E3\x1F4\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\tb\n1\t2\n3\t4\n");
  assertEquals(scalar, simd);
});

// Edge cases
Deno.test("record2tsv - empty input", async () => {
  const input = "";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - only field separator", async () => {
  const input = "\x1F\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "\t\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - only record separator", async () => {
  const input = "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - consecutive field separators", async () => {
  const input = "a\x1F\x1F\x1Fb\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\t\t\tb\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - consecutive record separators", async () => {
  const input = "a\x1E\x1E\x1Eb\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\n\n\nb\n");
  assertEquals(scalar, simd);
});

// Special characters
Deno.test("record2tsv - ASCII printable characters", async () => {
  const input = "hello\x1Fworld!\x1F@#$%^&*()\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "hello\tworld!\t@#$%^&*()\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - Unicode characters", async () => {
  const input = "café\x1F日本語\x1F🎉\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "café\t日本語\t🎉\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - spaces and punctuation", async () => {
  const input = "hello world\x1Ffoo, bar\x1Fbaz; qux\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "hello world\tfoo, bar\tbaz; qux\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - quotes and backslashes", async () => {
  const input = 'a"b\x1Fc\\d\x1Fe\'f\x1E';
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, 'a"b\tc\\d\te\'f\n');
  assertEquals(scalar, simd);
});

// Pathological cases
Deno.test("record2tsv - very long field", async () => {
  const longField = "x".repeat(10000);
  const input = `${longField}\x1Fb\x1E`;
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, `${longField}\tb\n`);
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - many fields", async () => {
  const fields = Array.from({ length: 1000 }, (_, i) => `f${i}`);
  const input = fields.join("\x1F") + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, fields.join("\t") + "\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - many records", async () => {
  const records = Array.from({ length: 1000 }, (_, i) => `a${i}\x1Fb${i}`);
  const input = records.join("\x1E") + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  const expected = records.map((r) => r.replace("\x1F", "\t")).join("\n") +
    "\n";
  assertEquals(simd, expected);
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - alternating separators", async () => {
  const input = "a\x1F\x1Eb\x1E\x1Fc\x1F\x1Ed\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\t\nb\n\tc\t\nd\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - all ASCII control chars except separators", async () => {
  // Test that other control characters pass through unchanged
  const input = "a\x01b\x02c\x03d\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\x01b\x02c\x03d\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - null bytes", async () => {
  const input = "a\x00b\x1Fc\x00d\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\x00b\tc\x00d\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - high byte values", async () => {
  const input = "a\xFFb\x1Fc\xFEd\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a\xFFb\tc\xFEd\n");
  assertEquals(scalar, simd);
});

// Boundary alignment tests (important for SIMD)
Deno.test("record2tsv - 15 byte input (just under SIMD boundary)", async () => {
  const input = "a".repeat(14) + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a".repeat(14) + "\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - 16 byte input (exactly SIMD boundary)", async () => {
  const input = "a".repeat(15) + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a".repeat(15) + "\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - 17 byte input (just over SIMD boundary)", async () => {
  const input = "a".repeat(16) + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a".repeat(16) + "\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - 32 byte input (two SIMD chunks)", async () => {
  const input = "a".repeat(31) + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a".repeat(31) + "\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - separators at SIMD boundaries", async () => {
  // Place separators at 16-byte boundaries
  const input = "a".repeat(15) + "\x1F" + "b".repeat(15) + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(simd, "a".repeat(15) + "\t" + "b".repeat(15) + "\n");
  assertEquals(scalar, simd);
});

Deno.test("record2tsv - mixed separators across boundaries", async () => {
  const input = "a".repeat(8) + "\x1F" + "b".repeat(7) + "\x1E" +
    "c".repeat(8) + "\x1F" + "d".repeat(7) + "\x1E";
  const simd = await record2tsv(input, false);
  const scalar = await record2tsv(input, true);
  assertEquals(
    simd,
    "a".repeat(8) + "\t" + "b".repeat(7) + "\n" + "c".repeat(8) + "\t" +
      "d".repeat(7) + "\n",
  );
  assertEquals(scalar, simd);
});
