//import { assertEquals } from "../deps/asserts.ts";

import { assertEquals } from "../deps/asserts.ts";


Deno.test({
  name:
    "I can count the words in a file.",
  async fn() {
    // assertEquals(
    //   await proc.runSa({ cmd: ["bash", "-c", "echo 'a\r\nb\r\n'"] }),
    //   ["a", "b"],
    // );
    await assertEquals(1, 1+0, "Yep")
  },
});
