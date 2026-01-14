import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  fromLazyRowBinary,
  toLazyRowBinary,
} from "../../src/transforms/lazyrow-binary.ts";
import { LazyRow } from "../../src/transforms/lazy-row.ts";

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iter) result.push(item);
  return result;
}

async function* toAsync<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

Deno.test("lazyrow-binary - round-trip string arrays", async () => {
  const input = [[["a", "b", "c"], ["d", "e", "f"]]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  const rows = output.flat();
  assertEquals(rows.length, 2);
  assertEquals(rows[0].toStringArray(), ["a", "b", "c"]);
  assertEquals(rows[1].toStringArray(), ["d", "e", "f"]);
});

Deno.test("lazyrow-binary - round-trip LazyRow", async () => {
  const input = [[
    LazyRow.fromStringArray(["x", "y"]),
    LazyRow.fromStringArray(["z", "w"]),
  ]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  const rows = output.flat();
  assertEquals(rows.length, 2);
  assertEquals(rows[0].toStringArray(), ["x", "y"]);
  assertEquals(rows[1].toStringArray(), ["z", "w"]);
});

Deno.test("lazyrow-binary - empty batch", async () => {
  const input: string[][][] = [[]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  assertEquals(binary.length, 0);
});

Deno.test("lazyrow-binary - empty fields", async () => {
  const input = [[["", "", ""]]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  assertEquals(output.flat()[0].toStringArray(), ["", "", ""]);
});

Deno.test("lazyrow-binary - single field", async () => {
  const input = [[["only"]]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  assertEquals(output.flat()[0].toStringArray(), ["only"]);
});

Deno.test("lazyrow-binary - UTF-8 characters", async () => {
  const input = [[["日本語", "émoji 🎉", "中文"]]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  assertEquals(output.flat()[0].toStringArray(), [
    "日本語",
    "émoji 🎉",
    "中文",
  ]);
});

Deno.test("lazyrow-binary - chunked input", async () => {
  const input = [[["a", "b"]]];
  const binary = (await collect(toLazyRowBinary()(toAsync(input))))[0];
  // Split binary into small chunks
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < binary.length; i += 4) {
    chunks.push(binary.slice(i, Math.min(i + 4, binary.length)));
  }
  const output = await collect(fromLazyRowBinary()(toAsync(chunks)));
  assertEquals(output.flat()[0].toStringArray(), ["a", "b"]);
});

Deno.test("lazyrow-binary - multiple batches", async () => {
  const input = [[["a", "b"]], [["c", "d"]], [["e", "f"]]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const combined = new Uint8Array(binary.reduce((s, b) => s + b.length, 0));
  let pos = 0;
  for (const b of binary) {
    combined.set(b, pos);
    pos += b.length;
  }
  const output = await collect(fromLazyRowBinary()(toAsync([combined])));
  const rows = output.flat();
  assertEquals(rows.length, 3);
  assertEquals(rows[0].toStringArray(), ["a", "b"]);
  assertEquals(rows[2].toStringArray(), ["e", "f"]);
});

// Pathological tests
Deno.test("lazyrow-binary pathological - 1MB field", async () => {
  const bigField = "x".repeat(1024 * 1024);
  const input = [[[bigField, "small"]]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  const row = output.flat()[0];
  assertEquals(row.getField(0).length, 1024 * 1024);
  assertEquals(row.getField(1), "small");
});

Deno.test("lazyrow-binary pathological - 100 columns", async () => {
  const fields = Array.from({ length: 100 }, (_, i) => `field${i}`);
  const input = [[fields]];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  const row = output.flat()[0];
  assertEquals(row.columnCount, 100);
  assertEquals(row.getField(99), "field99");
});

Deno.test("lazyrow-binary pathological - 1000 rows", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => [`row${i}`, `val${i}`]);
  const input = [rows];
  const binary = await collect(toLazyRowBinary()(toAsync(input)));
  const output = await collect(fromLazyRowBinary()(toAsync(binary)));
  const allRows = output.flat();
  assertEquals(allRows.length, 1000);
  assertEquals(allRows[999].getField(0), "row999");
});

Deno.test("lazyrow-binary pathological - single byte chunks", async () => {
  const input = [[["test", "data"]]];
  const binary = (await collect(toLazyRowBinary()(toAsync(input))))[0];
  const chunks = Array.from(binary).map((b) => new Uint8Array([b]));
  const output = await collect(fromLazyRowBinary()(toAsync(chunks)));
  assertEquals(output.flat()[0].toStringArray(), ["test", "data"]);
});
