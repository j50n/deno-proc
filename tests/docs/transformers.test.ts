import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  gunzip,
  gzip,
  jsonParse,
  jsonStringify,
  toBytes,
} from "../../src/transformers.ts";

Deno.test("toBytes - string to bytes", async () => {
  const result = await enumerate(["hello"])
    .transform(toBytes)
    .collect();

  const text = new TextDecoder().decode(result[0]);
  assertEquals(text, "hello\n");
});

Deno.test("toBytes - string array to bytes", async () => {
  const result = await enumerate([["line1", "line2"]])
    .transform(toBytes)
    .collect();

  const text = new TextDecoder().decode(result[0]);
  assertEquals(text, "line1\nline2\n");
});

Deno.test("jsonStringify - objects to JSON lines", async () => {
  const objects = [{ id: 1 }, { id: 2 }];
  const result = await enumerate(objects)
    .transform(jsonStringify)
    .collect();

  assertEquals(result, ['{"id":1}', '{"id":2}']);
});

Deno.test("jsonParse - JSON lines to objects", async () => {
  const lines = ['{"id":1}', '{"id":2}'];
  const result = await enumerate(lines)
    .transform(jsonParse)
    .collect();

  assertEquals(result, [{ id: 1 }, { id: 2 }]);
});

Deno.test("gzip and gunzip - compress and decompress", async () => {
  const original = "test data";

  const compressed = await enumerate([original])
    .transform(gzip)
    .collect();

  const decompressed = await enumerate(compressed)
    .transform(gunzip)
    .collect();

  const text = new TextDecoder().decode(decompressed[0]);
  // gzip adds newline when converting string
  assertEquals(text, original + "\n");
});
