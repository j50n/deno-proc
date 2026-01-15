/**
 * Unit tests for FlatdataProcessor WASM functions.
 * Tests the low-level WASM operations directly.
 */

import { assertEquals } from "@std/assert";
import { FlatdataProcessor } from "../src/wasm/flatdata-processor.ts";

Deno.test("FlatdataProcessor - recordToTsvFast - basic conversion", async () => {
  const processor = await FlatdataProcessor.create();

  const input = new TextEncoder().encode("a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });

  const chunks: Uint8Array[] = [];
  const write = (chunk: Uint8Array) => {
    chunks.push(chunk);
    return Promise.resolve(chunk.length);
  };

  await processor.recordToTsvFast(stream, write);

  const output = new TextDecoder().decode(
    new Uint8Array(chunks.flatMap((c) => Array.from(c))),
  );

  assertEquals(output, "a\tb\tc\n1\t2\t3\n");
});

Deno.test("FlatdataProcessor - recordToTsvFast - empty fields", async () => {
  const processor = await FlatdataProcessor.create();

  const input = new TextEncoder().encode("a\x1F\x1Fc\x1E");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });

  const chunks: Uint8Array[] = [];
  const write = (chunk: Uint8Array) => {
    chunks.push(chunk);
    return Promise.resolve(chunk.length);
  };

  await processor.recordToTsvFast(stream, write);

  const output = new TextDecoder().decode(
    new Uint8Array(chunks.flatMap((c) => Array.from(c))),
  );

  assertEquals(output, "a\t\tc\n");
});

Deno.test("FlatdataProcessor - recordToTsvFast - single field", async () => {
  const processor = await FlatdataProcessor.create();

  const input = new TextEncoder().encode("value\x1E");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });

  const chunks: Uint8Array[] = [];
  const write = (chunk: Uint8Array) => {
    chunks.push(chunk);
    return Promise.resolve(chunk.length);
  };

  await processor.recordToTsvFast(stream, write);

  const output = new TextDecoder().decode(
    new Uint8Array(chunks.flatMap((c) => Array.from(c))),
  );

  assertEquals(output, "value\n");
});

Deno.test("FlatdataProcessor - recordToTsvFast - special characters", async () => {
  const processor = await FlatdataProcessor.create();

  const input = new TextEncoder().encode("hello\x1Fworld!\x1F@#$\x1E");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });

  const chunks: Uint8Array[] = [];
  const write = (chunk: Uint8Array) => {
    chunks.push(chunk);
    return Promise.resolve(chunk.length);
  };

  await processor.recordToTsvFast(stream, write);

  const output = new TextDecoder().decode(
    new Uint8Array(chunks.flatMap((c) => Array.from(c))),
  );

  assertEquals(output, "hello\tworld!\t@#$\n");
});
