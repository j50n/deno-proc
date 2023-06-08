import { range } from "../mod3.ts";
import { assertEquals } from "./deps/asserts.ts";

Deno.test({
  name: "Range to forward.",
  async fn() {
    assertEquals(
      await range({ to: 3 }).collect(),
      [0, 1, 2],
      "Range to forward is correct.",
    );
  },
});

Deno.test({
  name: "Range to backward.",
  async fn() {
    assertEquals(
      await range({ to: -3, step: -1 }).collect(),
      [0, -1, -2],
      "Range to backward is correct.",
    );
  },
});

Deno.test({
  name: "Range until forward.",
  async fn() {
    assertEquals(
      await range({ until: 3 }).collect(),
      [0, 1, 2, 3],
      "Range to forward is correct.",
    );
  },
});

Deno.test({
  name: "Range until backward.",
  async fn() {
    assertEquals(await range({ until: -3, step: -1 }).collect(), [
      0,
      -1,
      -2,
      -3,
    ], "Range to backward is correct.");
  },
});
