import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import * as proc from "../../mod.ts";
import {
  enumerate,
  ExitCodeError,
  read,
  run,
  toLines,
  WritableIterable,
} from "../../mod.ts";

// Found in the pre-0.26.0 review.

/** Yields `items`, then throws. */
async function* failingAfter<T>(...items: T[]): AsyncGenerator<T> {
  yield* items;
  throw new Error("source failed");
}

/** Yields `first`, then never yields again. */
async function* stallsAfter<T>(first: T): AsyncGenerator<T> {
  yield first;
  await new Promise(() => {});
}

Deno.test("map delivers the last result before an upstream error.", async () => {
  const seen: string[] = [];
  await assertRejects(
    () =>
      run("sh", "-c", "echo a; echo 'FATAL: disk full'; exit 1").lines
        .map((line) => line.toUpperCase())
        .forEach((line) => {
          seen.push(line);
        }),
    ExitCodeError,
  );
  assertEquals(seen, ["A", "FATAL: DISK FULL"]);
});

Deno.test("map doesn't wait for the next item to deliver a result.", async () => {
  assertEquals(await enumerate(stallsAfter(1)).map((n) => n * 2).first, 2);
});

Deno.test("forEach waits for its last call when the source throws.", async () => {
  let finished = false;
  await assertRejects(
    () =>
      enumerate(failingAfter(1)).forEach(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        finished = true;
      }),
    Error,
    "source failed",
  );
  assertEquals(finished, true);
});

for (const method of ["concurrentMap", "concurrentUnorderedMap"] as const) {
  Deno.test(`${method} delivers the calls already started before a source error.`, async () => {
    const seen: number[] = [];
    await assertRejects(
      () =>
        enumerate(failingAfter(1, 2, 3))[method](
          (n) => Promise.resolve(n * 10),
          {
            concurrency: 4,
          },
        ).forEach((n) => {
          seen.push(n);
        }),
      Error,
      "source failed",
    );
    assertEquals(seen.sort(), [10, 20, 30]);
  });

  Deno.test(`${method} delivers a result without waiting for more items.`, async () => {
    const first = await enumerate(stallsAfter(1))[method](
      (n) => Promise.resolve(n * 10),
      { concurrency: 4 },
    ).first;
    assertEquals(first, 10);
  });
}

Deno.test("concurrency must be a number of at least 1.", () => {
  for (const concurrency of [0, -1, NaN]) {
    assertRejects(() =>
      enumerate([1]).concurrentMap((n) => Promise.resolve(n), { concurrency })
        .collect()
    );
  }
});

Deno.test("tee gives a source error to every branch.", async () => {
  const [a, b] = enumerate(failingAfter(1, 2)).tee();
  const results = await Promise.allSettled([a.collect(), b.collect()]);
  assertEquals(results.map((r) => r.status), ["rejected", "rejected"]);
});

Deno.test("tee closes a command's output once every branch stops early.", async () => {
  const yes = run("yes");
  const [a, b] = yes.lines.tee();
  assertEquals(await Promise.all([a.first, b.first]), ["y", "y"]);
  assertEquals((await yes.status).success, false); // never resolved before
});

Deno.test("concat closes the second source when the first one is enough.", async () => {
  const yes = run("yes");
  const first = await enumerate(["a"]).concat(yes.lines).take(1).collect();
  assertEquals(first, ["a"]);
  assertEquals((await yes.status).success, false); // never resolved before
});

Deno.test(".run() with a missing command closes the command feeding it.", async () => {
  const yes = run("yes");
  assertThrows(
    () => yes.run("no-such-command-proc-test"),
    Deno.errors.NotFound,
  );
  // yes exits once its output is closed; left unread, it would never exit.
  assertEquals((await yes.status).success, false);
});

Deno.test("writeTo(path) writes strings as lines.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await enumerate(["one", "two"]).writeTo(`${dir}/out.txt`);
    assertEquals(await Deno.readTextFile(`${dir}/out.txt`), "one\ntwo\n");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("A failed gzip pipeline doesn't write a complete-looking file.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await assertRejects(
      () =>
        enumerate(failingAfter("partial"))
          .transform(proc.toBytes)
          .transform(new CompressionStream("gzip"))
          .writeTo(`${dir}/out.gz`),
      Error,
      "source failed",
    );
    await assertRejects(() =>
      read(`${dir}/out.gz`).transform(new DecompressionStream("gzip"))
        .collect()
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test(".lines drops a CR at the very end of input.", async () => {
  const lines = await enumerate([new TextEncoder().encode("a\r\nb\r")])
    .transform(toLines).collect();
  assertEquals(lines, ["a", "b"]);
});

Deno.test(".first on an empty sequence says so.", async () => {
  await assertRejects(
    () => enumerate([]).first,
    RangeError,
    "the sequence is empty",
  );
});

Deno.test("Errors name the program, not its arguments.", async () => {
  await assertRejects(
    () => run("sh", "-c", "exit 3 # secret-token").lines.collect(),
    ExitCodeError,
    "sh exited with code 3",
  );
  const error = await run("sh", "-c", "exit 3 # secret-token").lines.collect()
    .catch((e) => e);
  assertEquals(error.message.includes("secret-token"), false);
});

Deno.test("A WritableIterable can be read once.", async () => {
  const items = new WritableIterable<number>();
  await items.write(1);
  await items.close();
  assertEquals(await enumerate(items).collect(), [1]);
  await assertRejects(
    () => enumerate(items).collect(),
    TypeError,
    "read only once",
  );
});

Deno.test("Writes after the reader stops go nowhere.", async () => {
  const items = new WritableIterable<number>();
  await items.write(1);
  assertEquals(await enumerate(items).first, 1);
  for (let i = 0; i < 1000; i++) await items.write(i);
  // deno-lint-ignore no-explicit-any
  assertEquals((items as any).queue.length, 1);
});

Deno.test("track is not part of the public API.", () => {
  assertEquals("track" in proc, false);
});

Deno.test("writeBytesTo finishes what was read before a source error, before the error comes out.", async () => {
  const written: number[] = [];
  const slowWriter = {
    async write(bytes: Uint8Array) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      written.push(bytes.length);
      return bytes.length;
    },
    close() {},
  };
  async function* source() {
    yield new Uint8Array(3);
    throw new Error("source failed");
  }

  await assertRejects(
    () => enumerate(source()).writeBytesTo(slowWriter),
    Error,
    "source failed",
  );
  assertEquals(written, [3]);
});
