import { assertEquals } from "https://deno.land/std@0.198.0/testing/asserts.ts";
import * as proc from "../mod.ts";

Deno.test({
  name: "Output printed to stderr does not end up in the output.",
  async fn() {
    assertEquals(
      await proc.runSa({
        cmd: ["bash", "-c", "echo 'a\nb\n' && echo 'printed to stderr' >&2"],
      }),
      ["a", "b"],
    );
  },
});
