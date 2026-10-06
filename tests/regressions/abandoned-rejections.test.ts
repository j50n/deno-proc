import { assertEquals, assertRejects } from "@std/assert";
import { buffer, enumerate } from "../../mod.ts";

/*
 * When an iteration stops on one error, work already started for other items
 * may fail too. Nobody is left to hear about those failures, and they must not
 * reach Deno as unhandled rejections, which end the process. The test runner
 * fails a test that leaves one behind.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function* oneThenThrow() {
  yield 1;
  await sleep(30);
  throw new Error("source failed");
}

for (const name of ["concurrentMap", "concurrentUnorderedMap"] as const) {
  Deno.test({
    name:
      `${name}: after the first failure is thrown, later failures are not unhandled.`,

    async fn() {
      await assertRejects(
        () =>
          enumerate([1, 2, 3, 4])[name](async (n) => {
            await sleep(n * 20);
            throw new Error(`fail ${n}`);
          }, { concurrency: 4 }).collect(),
        Error,
        "fail 1",
      );
      await sleep(150);
    },
  });
}

Deno.test({
  name:
    "map: when the source fails while an item is still mapping, that item's failure is not unhandled.",

  async fn() {
    await assertRejects(
      () =>
        enumerate(oneThenThrow()).map(async () => {
          await sleep(10);
          throw new Error("map failed");
        }).collect(),
      Error,
      "source failed",
    );
    await sleep(50);
  },
});

Deno.test({
  name:
    "forEach: when the source fails while an item is still being handled, that item's failure is not unhandled.",

  async fn() {
    await assertRejects(
      () =>
        enumerate(oneThenThrow()).forEach(async () => {
          await sleep(10);
          throw new Error("forEach failed");
        }),
      Error,
      "source failed",
    );
    await sleep(50);
  },
});

Deno.test({
  name: "buffer(n) gathers pieces into chunks of at least n bytes throughout.",

  async fn() {
    const sizes = await enumerate(
      Array.from({ length: 10 }, () => new Uint8Array(1000)),
    ).transform(buffer(4000)).map((b) => b.length).collect();

    assertEquals(sizes, [4000, 4000, 2000]);
  },
});
