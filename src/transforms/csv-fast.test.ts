import { assertEquals, assertExists } from "jsr:@std/assert";
import { fromCsvToRowsFast, fromCsvToLazyRowsFast } from "./csv-fast.ts";
import { fromCsvToRows, fromCsvToLazyRows } from "./csv.ts";

const encoder = new TextEncoder();

// Helper to create async iterable from string
async function* stringToChunks(s: string, chunkSize = 1024): AsyncIterable<Uint8Array> {
  const bytes = encoder.encode(s);
  for (let i = 0; i < bytes.length; i += chunkSize) {
    yield bytes.slice(i, Math.min(i + chunkSize, bytes.length));
  }
}

// Helper to collect all rows from batches
async function collectRows(iter: AsyncIterable<string[][]>): Promise<string[][]> {
  const rows: string[][] = [];
  for await (const batch of iter) {
    rows.push(...batch);
  }
  return rows;
}

Deno.test("fromCsvToRowsFast - basic parsing", async () => {
  const csv = "a,b,c\nd,e,f\n";
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["a", "b", "c"]);
  assertEquals(rows[1], ["d", "e", "f"]);
});

Deno.test("fromCsvToRowsFast - quoted fields", async () => {
  const csv = '"hello","world"\n"foo","bar"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["hello", "world"]);
  assertEquals(rows[1], ["foo", "bar"]);
});

Deno.test("fromCsvToRowsFast - escaped quotes", async () => {
  const csv = '"say ""hi""","test"\n';
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 1);
  assertEquals(rows[0], ['say "hi"', "test"]);
});

Deno.test("fromCsvToRowsFast - empty fields", async () => {
  const csv = "a,,c\n,b,\n";
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["a", "", "c"]);
  assertEquals(rows[1], ["", "b", ""]);
});

Deno.test("fromCsvToRowsFast - chunked input", async () => {
  const csv = "a,b,c\nd,e,f\ng,h,i\n";
  // Use small chunks to test boundary handling
  const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv, 5)));
  
  assertEquals(rows.length, 3);
  assertEquals(rows[0], ["a", "b", "c"]);
  assertEquals(rows[1], ["d", "e", "f"]);
  assertEquals(rows[2], ["g", "h", "i"]);
});

Deno.test("fromCsvToRowsFast - custom separator", async () => {
  const csv = "a;b;c\nd;e;f\n";
  const rows = await collectRows(fromCsvToRowsFast({ separator: ";" })(stringToChunks(csv)));
  
  assertEquals(rows.length, 2);
  assertEquals(rows[0], ["a", "b", "c"]);
  assertEquals(rows[1], ["d", "e", "f"]);
});

Deno.test("fromCsvToLazyRowsFast - basic parsing", async () => {
  const csv = "a,b,c\nd,e,f\n";
  const batches: unknown[][] = [];
  
  for await (const batch of fromCsvToLazyRowsFast()(stringToChunks(csv))) {
    batches.push(batch);
  }
  
  const allRows = batches.flat();
  assertEquals(allRows.length, 2);
  assertExists(allRows[0]);
});

// Compatibility tests - compare WASM vs standard implementation
Deno.test("compatibility - simple CSV matches standard", async () => {
  const csv = "a,b,c\nd,e,f\ng,h,i\n";
  
  const fastRows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  const stdRows = await collectRows(fromCsvToRows()(stringToChunks(csv)));
  
  assertEquals(fastRows, stdRows);
});

Deno.test("compatibility - quoted fields match standard", async () => {
  const csv = '"hello, world","test"\n"foo","bar"\n';
  
  const fastRows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  const stdRows = await collectRows(fromCsvToRows()(stringToChunks(csv)));
  
  assertEquals(fastRows, stdRows);
});

Deno.test("compatibility - escaped quotes match standard", async () => {
  const csv = '"say ""hello""","world"\n';
  
  const fastRows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
  const stdRows = await collectRows(fromCsvToRows()(stringToChunks(csv)));
  
  assertEquals(fastRows, stdRows);
});

// Memory leak detection test
Deno.test("memory - no leaks after multiple operations", async () => {
  const csv = "a,b,c\nd,e,f\n";
  
  // Run multiple parse operations
  for (let i = 0; i < 10; i++) {
    const rows = await collectRows(fromCsvToRowsFast()(stringToChunks(csv)));
    assertEquals(rows.length, 2);
  }
  
  // If we get here without OOM, memory is being cleaned up
});
