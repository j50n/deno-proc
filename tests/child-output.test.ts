import { assert, assertEquals, assertLess } from "@std/assert";
import { ChildOutput } from "../src/child-output.ts";

// A child's stdout, on plain streams: no child process needed.

const bytes = (...values: number[]) => new Uint8Array(values);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A stream that gives `chunks`, then ends, or stays open if `open`. */
function stream(chunks: Uint8Array<ArrayBuffer>[], open = false) {
  const state = { cancelled: false };
  const readable = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (!open) controller.close();
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { readable, state };
}

Deno.test("read gives every chunk, to the end.", async () => {
  const { readable } = stream([bytes(1), bytes(2)]);
  const output = new ChildOutput(readable);
  assertEquals(await Array.fromAsync(output.read()), [bytes(1), bytes(2)]);
});

Deno.test("Output nobody is reading at the exit is read then, and kept for a later reader.", async () => {
  const { readable } = stream([bytes(1), bytes(2)]);
  const output = new ChildOutput(readable);
  output.exited(false);
  await sleep(10);
  assert(!readable.locked, "read to the end and let go");
  assertEquals(await Array.fromAsync(output.read()), [bytes(1), bytes(2)]);
});

Deno.test("Reading at the exit stops at a pause, so a pipe held open can't keep it going.", async () => {
  const { readable } = stream([bytes(1)], true);
  const output = new ChildOutput(readable);
  output.exited(false);
  const start = Date.now();
  assertEquals(await Array.fromAsync(output.read()), [bytes(1)]);
  assertLess(Date.now() - start, 1000);
});

Deno.test("A stream already being read elsewhere is left alone at the exit.", async () => {
  const { readable } = stream([bytes(1)]);
  const reader = readable.getReader();
  new ChildOutput(readable).exited(false); // 0.28.0 threw here, uncaught.
  assertEquals((await reader.read()).value, bytes(1));
});

Deno.test("After a timeout, a reader waiting on a quiet pipe is let go.", async () => {
  const { readable } = stream([bytes(1)], true);
  const output = new ChildOutput(readable);
  const chunks: Uint8Array[] = [];
  const reading = (async () => {
    for await (const chunk of output.read()) chunks.push(chunk);
  })();
  await sleep(50);
  const start = Date.now();
  output.exited(true);
  await reading;
  assertEquals(chunks, [bytes(1)]);
  assertLess(Date.now() - start, 1000);
});

Deno.test("Without a timeout, a reader waits for the end, however long.", async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>;
  const readable = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(c) {
      controller = c;
    },
  });
  const output = new ChildOutput(readable);
  const reading = Array.fromAsync(output.read());
  await sleep(10);
  output.exited(false);
  await sleep(300); // Longer than the pause that ends it after a timeout.
  controller.enqueue(bytes(7));
  controller.close();
  assertEquals(await reading, [bytes(7)]);
});

Deno.test("Stopping early cancels the stream, which tells the child.", async () => {
  const { readable, state } = stream([bytes(1), bytes(2)], true);
  for await (const _ of new ChildOutput(readable).read()) break;
  assert(state.cancelled);
});
