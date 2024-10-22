import { range } from "../../mod.ts";
import { assertEquals } from "../deps/asserts.ts";

Deno.test({
  name: "I can take a couple of items at the head.",
  async fn() {
    const result = await range({ from: 1, until: 10 }).take(2).collect();

    assertEquals(
      result,
      [1, 2],
      "I can take a couple of items from the head of the enumeration.",
    );
  },
});

Deno.test({
  name: "I can drop a couple of items at the head and take the rest.",
  async fn() {
    const result = await range({ from: 1, until: 10 }).drop(2).collect();

    assertEquals(
      result,
      [3, 4, 5, 6, 7, 8, 9, 10],
      "I can drop a couple of items from the head of the enumeration and take the rest.",
    );
  },
});

/*
 * Tee is magical, which means it probably is holding values in memory until they are
 * consumed. It won't block, but I don't expect this operation to be fully streaming.
 */
Deno.test({
  name: "I can use tee to get the head and tail simultaneously.",
  async fn() {
    const [rh, rt] = range({ from: 1, until: 10 }).tee();

    const [head, tail] = await Promise.all([
      rh.take(2).collect(),
      rt.drop(2).collect(),
    ]);

    assertEquals(
      head,
      [1, 2],
      "Got the head.",
    );
    assertEquals(
      tail,
      [3, 4, 5, 6, 7, 8, 9, 10],
      "Got the tail.",
    );
  },
});

Deno.test({
  name: "Head of 0 is empty.",
  async fn() {
    const result = await range({ from: 1, until: 10 }).take(0).collect();

    assertEquals(
      result,
      [],
      "0 items taken, 0 items delivered.",
    );
  },
});

Deno.test({
  name: "Tail of 0 is the original thing.",
  async fn() {
    const result = await range({ from: 1, until: 10 }).drop(0).collect();

    assertEquals(
      result,
      await range({ from: 1, until: 10 }).collect(),
      "0 items dropped, all items delivered.",
    );
  },
});
