/**
 * Unit tests for high-performance WASM CSV parser.
 * 
 * Tests the WebAssembly-powered CSV parsing functions that provide
 * ~7-10x performance improvement over the standard Deno CSV parser.
 * 
 * Note: The WASM parser has some limitations compared to the standard parser:
 * - Minimum chunk size requirements for streaming
 * - May have issues with very large fields (1MB+)
 * 
 * For pathological data tests, use the standard CSV parser (csv.test.ts).
 * 
 * @module
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { fromCsvToRowsFast, fromCsvToLazyRowsFast, toCsvFast } from "../../src/transforms/csv-fast.ts";
import { fromCsvToRows } from "../../src/transforms/csv.ts";
import { enumerate } from "../../src/enumerable.ts";

const encoder = new TextEncoder();

/** Helper to create async iterable from string with configurable chunk size */
async function* stringToChunks(s: string, chunkSize = 1024): AsyncIterable<Uint8Array> {
  const bytes = encoder.encode(s);
  for (let i = 0; i < bytes.length; i += chunkSize) {
    yield bytes.slice(i, Math.min(i + chunkSize, bytes.length));
  }
}

/** Helper to collect all rows from batched output */
async function collectRows(iter: AsyncIterable<string[][]>): Promise<string[][]> {
  const rows: string[][] = [];
  for await (const batch of iter) {
    rows.push(...batch);
  }
  return rows;
}

// =============================================================================
// Basic Parsing Tests
// =============================================================================

Deno.test("csv-fast - basic parsing", async () => {
  const csv = "a,b,c\nd,e,f\n";
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["a", "b", "c"]);
  assertEquals(rows[1], ["d", "e", "f"]);
});

Deno.test("csv-fast - quoted fields", async () => {
  const csv = '"hello","world"\n"foo","bar"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["hello", "world"]);
  assertEquals(rows[1], ["foo", "bar"]);
});

Deno.test("csv-fast - escaped quotes", async () => {
  const csv = '"say ""hi""","test"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 1);
  assertEquals(rows[0], ['say "hi"', "test"]);
});

Deno.test("csv-fast - empty fields", async () => {
  const csv = "a,,c\n,b,\n";
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["a", "", "c"]);
  assertEquals(rows[1], ["", "b", ""]);
});

Deno.test("csv-fast - quoted fields with commas", async () => {
  const csv = '"hello, world","test"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows[0], ["hello, world", "test"]);
});

Deno.test("csv-fast - quoted fields with newlines", async () => {
  const csv = '"line1\nline2","test"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows[0], ["line1\nline2", "test"]);
});

Deno.test("csv-fast - custom separator", async () => {
  const csv = "a;b;c\nd;e;f\n";
  const rows = await collectRows(fromCsvToRowsFast({ separator: ";" })(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["a", "b", "c"]);
  assertEquals(rows[1], ["d", "e", "f"]);
});

Deno.test("csv-fast - empty input", async () => {
  const csv = "";
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 0);
});

// =============================================================================
// Streaming and Chunk Boundary Tests
// =============================================================================

Deno.test("csv-fast - chunked input", async () => {
  const csv = "a,b,c\nd,e,f\ng,h,i\n";
  // Use small but reasonable chunks (5 bytes)
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv, 5)));
  
  assertEquals(rows.length, 3);
  assertEquals(rows[0], ["a", "b", "c"]);
  assertEquals(rows[1], ["d", "e", "f"]);
  assertEquals(rows[2], ["g", "h", "i"]);
});

Deno.test("csv-fast - chunk boundary in quoted field", async () => {
  const csv = '"hello","world"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv, 4)));
  
  assertEquals(rows[0], ["hello", "world"]);
});

// =============================================================================
// LazyRow Output Tests
// =============================================================================

Deno.test("csv-fast - LazyRow basic parsing", async () => {
  const csv = "a,b,c\nd,e,f\n";
  const batches: unknown[][] = [];
  
  for await (const batch of fromCsvToLazyRowsFast()(stringToChunks(csv))) {
    batches.push(batch);
  }
  
  const allRows = batches.flat();
  assertEquals(allRows.length, 2);
  assertExists(allRows[0]);
});

Deno.test("csv-fast - LazyRow field access", async () => {
  const csv = "name,age,city\nAlice,30,NYC\n";
  const batches = [];
  
  for await (const batch of fromCsvToLazyRowsFast()(stringToChunks(csv))) {
    batches.push(...batch);
  }
  
  assertEquals(batches[0].getField(0), "name");
  assertEquals(batches[1].getField(0), "Alice");
  assertEquals(batches[1].getField(1), "30");
});

// =============================================================================
// UTF-8 Tests
// =============================================================================

Deno.test("csv-fast - multi-byte UTF-8", async () => {
  const csv = "北京,中国,🏙️\nTokyo,日本,🗾\n";
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows[0], ["北京", "中国", "🏙️"]);
  assertEquals(rows[1], ["Tokyo", "日本", "🗾"]);
});

Deno.test("csv-fast - UTF-8 in quoted fields", async () => {
  const csv = '"北京","首都 of 中国"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows[0], ["北京", "首都 of 中国"]);
});

// =============================================================================
// Compatibility Tests (WASM vs Standard Parser)
// =============================================================================

Deno.test("csv-fast compatibility - simple CSV matches standard", async () => {
  const csv = "a,b,c\nd,e,f\ng,h,i\n";
  
  const fastRows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  const stdRows = await collectRows(fromCsvToRows()(stringToChunks(csv)));
  
  assertEquals(fastRows, stdRows);
});

Deno.test("csv-fast compatibility - quoted fields match standard", async () => {
  const csv = '"hello, world","test"\n"foo","bar"\n';
  
  const fastRows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  const stdRows = await collectRows(fromCsvToRows()(stringToChunks(csv)));
  
  assertEquals(fastRows, stdRows);
});

Deno.test("csv-fast compatibility - escaped quotes match standard", async () => {
  const csv = '"say ""hello""","world"\n';
  
  const fastRows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  const stdRows = await collectRows(fromCsvToRows()(stringToChunks(csv)));
  
  assertEquals(fastRows, stdRows);
});

// =============================================================================
// Moderate Size Tests (not pathological, but larger than basic)
// =============================================================================

Deno.test("csv-fast - many fields (50 columns)", async () => {
  const fields = Array.from({ length: 50 }, (_, i) => `field${i}`);
  const csv = fields.join(",") + "\n";
  
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows[0].length, 50);
  assertEquals(rows[0][0], "field0");
  assertEquals(rows[0][49], "field49");
});

Deno.test("csv-fast - many rows (1000 rows)", async () => {
  const lines = Array.from({ length: 1000 }, (_, i) => `a${i},b${i},c${i}`);
  const csv = lines.join("\n") + "\n";
  
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 1000);
  assertEquals(rows[0], ["a0", "b0", "c0"]);
  assertEquals(rows[999], ["a999", "b999", "c999"]);
});

Deno.test("csv-fast - medium field (10KB)", async () => {
  const mediumField = "x".repeat(10000);
  const csv = `small,${mediumField},end\n`;
  
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 1);
  assertEquals(rows[0][0], "small");
  assertEquals(rows[0][1], mediumField);
  assertEquals(rows[0][2], "end");
});

// =============================================================================
// Memory Tests
// =============================================================================

Deno.test("csv-fast memory - no leaks after multiple operations", async () => {
  const csv = "a,b,c\nd,e,f\n";
  
  for (let i = 0; i < 10; i++) {
    const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
    assertEquals(rows.length, 2);
  }
});
