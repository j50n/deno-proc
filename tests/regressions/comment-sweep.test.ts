import { assertEquals, assertRejects } from "@std/assert";
import { enumerate, toByteLines, WritableIterable } from "../../mod.ts";

// Bugs found while rewriting the doc comments.

Deno.test("take(n) ends after the nth item, without waiting for another.", async () => {
  let pulledThird = false;
  async function* slow() {
    yield 1;
    yield 2;
    pulledThird = true;
    await new Promise(() => {}); // never yields a third item
  }

  assertEquals(await enumerate(slow()).take(2).collect(), [1, 2]);
  assertEquals(pulledThird, false);
});

Deno.test("take(0) yields nothing.", async () => {
  assertEquals(await enumerate([1, 2]).take(0).collect(), []);
});

Deno.test("toByteLines yields a new array for each batch.", async () => {
  const encoder = new TextEncoder();
  const batches = await enumerate([
    encoder.encode("a\nb"),
    encoder.encode("\nc\n"),
  ])
    .transform(toByteLines)
    .collect();
  const decoder = new TextDecoder();

  assertEquals(
    batches.map((batch) => batch.map((line) => decoder.decode(line))),
    [["a"], ["b", "c"]],
  );
});

Deno.test("writeTo a Writable with noclose throws the source's error.", async () => {
  async function* failing() {
    yield "p";
    throw new Error("source failed");
  }
  const sink = new WritableIterable<string>();
  const read = enumerate(sink).collect();

  await assertRejects(
    () => enumerate(failing()).writeTo(sink, { noclose: true }),
    Error,
    "source failed",
  );
  await sink.close();
  assertEquals(await read, ["p"]);
});

Deno.test("toTsv and toRecord handle a stream that mixes rows and batches.", async () => {
  const { toRecord, toTsv } = await import("../../src/transforms/mod.ts");
  const decoder = new TextDecoder();
  const mixed = () =>
    enumerate<string[] | string[][]>([[["c", "d"]], ["a", "b"], [["e", "f"]]]);

  const tsv = await mixed().transform(toTsv()).collect();
  assertEquals(
    tsv.map((b) => decoder.decode(b)).join(""),
    "c\td\na\tb\ne\tf\n",
  );

  const record = await mixed().transform(toRecord()).collect();
  assertEquals(
    record.map((b) => decoder.decode(b)).join(""),
    "c\x1Fd\x1Ea\x1Fb\x1Ee\x1Ff\x1E",
  );
});

Deno.test("writeTo(path) needs only write permission.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const mod = new URL("../../mod.ts", import.meta.url).href;
    const code = `
      import { enumerate, toBytes } from "${mod}";
      await enumerate(["a"]).transform(toBytes).writeTo("${dir}/out.txt");`;
    const { success, stderr } = await new Deno.Command(Deno.execPath(), {
      args: ["eval", "--no-check", `--allow-write=${dir}`, code],
    }).output();

    assertEquals(success, true, new TextDecoder().decode(stderr));
    assertEquals(await Deno.readTextFile(`${dir}/out.txt`), "a\n");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("forEach takes a callback that returns a value.", async () => {
  const seen: number[] = [];
  await enumerate([1, 2]).forEach((n) => seen.push(n));
  assertEquals(seen, [1, 2]);
});
