/**
 * TSV to record format, as the flatdata CLI's tsv2record does it.
 */

import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromTsvToRows, toRecord } from "../../src/transforms/mod.ts";

async function tsv2record(input: string): Promise<string> {
  const chunks = await enumerate([new TextEncoder().encode(input)])
    .transform(fromTsvToRows())
    .transform(toRecord())
    .collect();
  return chunks.map((chunk) => new TextDecoder().decode(chunk)).join("");
}

// Basic functionality tests
Deno.test("tsv2record - basic conversion", async () => {
  const result = await tsv2record("a\tb\tc\n1\t2\t3\n");
  assertEquals(result, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

Deno.test("tsv2record - empty fields", async () => {
  const result = await tsv2record("a\t\tc\n");
  assertEquals(result, "a\x1F\x1Fc\x1E");
});

Deno.test("tsv2record - single field", async () => {
  const result = await tsv2record("value\n");
  assertEquals(result, "value\x1E");
});

Deno.test("tsv2record - single record multiple fields", async () => {
  const result = await tsv2record("a\tb\tc\td\te\n");
  assertEquals(result, "a\x1Fb\x1Fc\x1Fd\x1Fe\x1E");
});

Deno.test("tsv2record - multiple records", async () => {
  const result = await tsv2record("a\tb\n1\t2\n3\t4\n");
  assertEquals(result, "a\x1Fb\x1E1\x1F2\x1E3\x1F4\x1E");
});

// Edge cases
Deno.test("tsv2record - empty input", async () => {
  const result = await tsv2record("");
  assertEquals(result, "");
});

Deno.test("tsv2record - only tab", async () => {
  const result = await tsv2record("\t\n");
  assertEquals(result, "\x1F\x1E");
});

Deno.test("tsv2record - only newline is no record", async () => {
  const result = await tsv2record("\n");
  assertEquals(result, "");
});

Deno.test("tsv2record - consecutive tabs", async () => {
  const result = await tsv2record("a\t\t\tb\n");
  assertEquals(result, "a\x1F\x1F\x1Fb\x1E");
});

Deno.test("tsv2record - blank lines are skipped", async () => {
  const result = await tsv2record("a\n\n\nb\n");
  assertEquals(result, "a\x1Eb\x1E");
});

// Carriage return handling
Deno.test("tsv2record - strips \\r from \\r\\n", async () => {
  const result = await tsv2record("a\tb\r\n1\t2\r\n");
  assertEquals(result, "a\x1Fb\x1E1\x1F2\x1E");
});

Deno.test("tsv2record - strips standalone \\r", async () => {
  const result = await tsv2record("a\rb\tc\r\n");
  assertEquals(result, "ab\x1Fc\x1E");
});

Deno.test("tsv2record - strips multiple \\r", async () => {
  const result = await tsv2record("a\r\r\rb\tc\n");
  assertEquals(result, "ab\x1Fc\x1E");
});

// Special characters
Deno.test("tsv2record - unicode characters", async () => {
  const result = await tsv2record("hello\t世界\temoji🎉\n");
  assertEquals(result, "hello\x1F世界\x1Femoji🎉\x1E");
});

Deno.test("tsv2record - special ASCII characters", async () => {
  const result = await tsv2record("a@#$\tb%^&\tc*()\n");
  assertEquals(result, "a@#$\x1Fb%^&\x1Fc*()\x1E");
});

Deno.test("tsv2record - quotes and commas (no escaping needed)", async () => {
  const result = await tsv2record("a\"b\tc,d\te'f\n");
  assertEquals(result, "a\"b\x1Fc,d\x1Fe'f\x1E");
});

Deno.test("tsv2record - null bytes", async () => {
  const result = await tsv2record("a\x00b\tc\n");
  assertEquals(result, "a\x00b\x1Fc\x1E");
});

// Pathological cases
Deno.test("tsv2record - very long field (10K chars)", async () => {
  const longField = "x".repeat(10000);
  const result = await tsv2record(`${longField}\tb\n`);
  assertEquals(result, `${longField}\x1Fb\x1E`);
});

Deno.test("tsv2record - many fields (1000 fields)", async () => {
  const fields = Array.from({ length: 1000 }, (_, i) => `f${i}`);
  const result = await tsv2record(fields.join("\t") + "\n");
  assertEquals(result, fields.join("\x1F") + "\x1E");
});

Deno.test("tsv2record - many records (5000 records)", async () => {
  const records = Array.from({ length: 5000 }, (_, i) => `a${i}\tb${i}`);
  const input = records.join("\n") + "\n";
  const result = await tsv2record(input);
  const expected = records.map((r) => r.replace(/\t/g, "\x1F")).join("\x1E") +
    "\x1E";
  assertEquals(result, expected);
});

Deno.test("tsv2record - mixed line endings", async () => {
  const result = await tsv2record("a\tb\r\nc\td\ne\tf\r\n");
  assertEquals(result, "a\x1Fb\x1Ec\x1Fd\x1Ee\x1Ff\x1E");
});

// SIMD boundary conditions (16-byte boundaries)
Deno.test("tsv2record - 15 byte input", async () => {
  const input = "a".repeat(14) + "\n";
  const result = await tsv2record(input);
  assertEquals(result, "a".repeat(14) + "\x1E");
});

Deno.test("tsv2record - 16 byte input", async () => {
  const input = "a".repeat(15) + "\n";
  const result = await tsv2record(input);
  assertEquals(result, "a".repeat(15) + "\x1E");
});

Deno.test("tsv2record - 17 byte input", async () => {
  const input = "a".repeat(16) + "\n";
  const result = await tsv2record(input);
  assertEquals(result, "a".repeat(16) + "\x1E");
});

Deno.test("tsv2record - 32 byte input", async () => {
  const input = "a".repeat(31) + "\n";
  const result = await tsv2record(input);
  assertEquals(result, "a".repeat(31) + "\x1E");
});

// No trailing newline
Deno.test("tsv2record - no trailing newline still ends the record", async () => {
  const result = await tsv2record("a\tb\tc");
  assertEquals(result, "a\x1Fb\x1Fc\x1E");
});

Deno.test("tsv2record - multiple records no trailing newline", async () => {
  const result = await tsv2record("a\tb\n1\t2");
  assertEquals(result, "a\x1Fb\x1E1\x1F2\x1E");
});
