import { ProcReadableStream } from "../../mod.ts";
import { readableStreamFromIterable } from "../deps/streams.ts";
import { asynciter } from "../deps/asynciter.ts";
import { assertEquals, assertRejects } from "../deps/asserts.ts";

Deno.test({
  name: "ProcReadableStream.toText() converts UTF8 bytes to text.",
  async fn() {
    const bytes = new ProcReadableStream(
      readableStreamFromIterable(["abc\n", "123\n"]).pipeThrough(
        new TextEncoderStream(),
      ),
    );
    assertEquals(
      (await asynciter(bytes.asTextLines()).collect()).join("|"),
      "abc|123",
      "Passed in text matches decoded text.",
    );
  },
});

Deno.test({
  name:
    "ProcReadableStream.toText() should fail if passed anything but Uint8Array.",
  async fn() {
    await assertRejects(
      async () => {
        const text = new ProcReadableStream(
          readableStreamFromIterable(["abc\n", "123\n"]),
        );
          (await asynciter(text.asTextLines()).collect())
      },
      TypeError,
      "chunk is not an ArrayBuffer",
      "Chunks converted to text must be arrays of bytes.",
    );
  },
});
