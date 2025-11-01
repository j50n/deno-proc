import { assertEquals } from "@std/assert";
import { concat, isString, range, read } from "../../src/utility.ts";

Deno.test("range - to (exclusive)", async () => {
  const result = await range({ to: 3 }).collect();
  assertEquals(result, [0, 1, 2]);
});

Deno.test("range - until (inclusive)", async () => {
  const result = await range({ from: 1, until: 3 }).collect();
  assertEquals(result, [1, 2, 3]);
});

Deno.test("range - negative step", async () => {
  const result = await range({ from: -1, until: -3, step: -1 }).collect();
  assertEquals(result, [-1, -2, -3]);
});

Deno.test("concat - single array", () => {
  const arr = new Uint8Array([1, 2, 3]);
  const result = concat([arr]);
  assertEquals(result, arr);
});

Deno.test("concat - multiple arrays", () => {
  const result = concat([
    new Uint8Array([1, 2]),
    new Uint8Array([3, 4]),
  ]);
  assertEquals(result, new Uint8Array([1, 2, 3, 4]));
});

Deno.test("read - file as bytes", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tempFile, "test");

  const bytes = await read(tempFile).collect();
  const text = new TextDecoder().decode(concat(bytes));

  assertEquals(text, "test");
  await Deno.remove(tempFile);
});

Deno.test("isString - type guard", () => {
  assertEquals(isString("hello"), true);
  assertEquals(isString(123), false);
  assertEquals(isString(new Uint8Array()), false);
});
