import { assertEquals } from "../../deps-test.ts";
import { ProcGroup } from "../proc-group.ts";
import { bytesIterableInput, bytesIterableOutput } from "./bytes-iterable.ts";
import { emptyInput } from "./empty.ts";
import { stringOutput } from "./string.ts";

Deno.test({
  name:
    "[HAPPY-PATH] I can connect processes together with AsyncIterable<Uint8Array>.",
  async fn() {
    /*
     * I am compressing some text with gzip, then uncompressing it. There are three
     * external processes being orchestrated here.
     */
    const proc = new ProcGroup();
    try {
      const out1 = await proc.run(
        emptyInput(),
        bytesIterableOutput(),
        undefined,
        { cmd: ["bash", "-c", "echo 'Hello, world.'"] },
      );
      const out2 = await proc.run(
        bytesIterableInput(),
        bytesIterableOutput(),
        out1,
        { cmd: ["gzip", "-c"] },
      );
      const out3 = await proc.run(bytesIterableInput(), stringOutput(), out2, {
        cmd: ["gzip", "-cd"],
      });

      assertEquals(out3, "Hello, world.");
    } finally {
      proc.close();
    }
  },
});
