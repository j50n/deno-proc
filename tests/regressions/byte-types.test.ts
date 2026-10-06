import { assertEquals } from "@std/assert";
import { enumerate, read, run, toBytes } from "../../mod.ts";

// These pipelines are the ones the docs lead with. They have to type-check as
// written: under TypeScript 6, `CompressionStream` takes only bytes in an
// `ArrayBuffer`, so proc's byte sources must say that's what they yield.

Deno.test("Bytes from read, run, and toBytes go through the built-in compression streams.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const path = `${dir}/lines.txt.gz`;

    await enumerate(["one", "two"])
      .transform(toBytes)
      .transform(new CompressionStream("gzip"))
      .writeTo(path);

    assertEquals(
      await read(path).transform(new DecompressionStream("gzip")).lines
        .collect(),
      ["one", "two"],
    );
    assertEquals(
      await run("cat", path).transform(new DecompressionStream("gzip")).lines
        .collect(),
      ["one", "two"],
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("toBytes copies bytes that live in a SharedArrayBuffer.", async () => {
  const shared = new Uint8Array(new SharedArrayBuffer(2));
  shared.set([104, 105]);

  const [out] = await enumerate([shared]).transform(toBytes).collect();

  assertEquals(out.buffer instanceof ArrayBuffer, true);
  assertEquals([...out], [104, 105]);
});
