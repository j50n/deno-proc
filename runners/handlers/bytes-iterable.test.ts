import { assertEquals } from "../../deps-test.ts";
import { ProcessGroup } from "../process-group.ts";
import { BytesIterableInput, BytesIterableOutput } from "./bytes-iterable.ts";
import { EmptyInput } from "./empty.ts";
import { StringOutput } from "./string.ts";

Deno.test({
  name: "I can connect processes together with AsyncIterable<Uint8Array>.",
  async fn() {
    /*
     * I am compressing some text with gzip, then uncompressing it. There are three
     * external processes being orchestrated here.
     */
    const proc = new ProcessGroup();
    try {
      const out1 = await proc.run(
        EmptyInput(),
        BytesIterableOutput(),
        undefined,
        { cmd: ["bash", "-c", "echo 'Hello, world.'"] },
      );
      const out2 = await proc.run(
        BytesIterableInput(),
        BytesIterableOutput(),
        out1,
        { cmd: ["gzip", "-c"] },
      );
      const out3 = await proc.run(BytesIterableInput(), StringOutput(), out2, {
        cmd: ["gzip", "-cd"],
      });

      assertEquals(out3, "Hello, world.");
    } finally {
      proc.close();
    }
  },
});
