import { assertEquals } from "https://deno.land/std@0.177.1/testing/asserts.ts";
import * as proc from "../mod.ts";

Deno.test({
  name:
    "Line splits must remove carriage returns at end of line and also remove empty line at end of input.",
  async fn() {
    assertEquals(
      await proc.runSa({ cmd: ["bash", "-c", "echo 'a\r\nb\r\n'"] }),
      ["a", "b"],
    );
  },
});
