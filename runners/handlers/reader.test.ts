import { assertEquals } from "../../deps-test.ts";
import { ClosableStringReader } from "../closers.ts";
import { procgroup } from "../proc-group.ts";
import { ReaderInput } from "./reader.ts";
import { StringOutput } from "./string.ts";

Deno.test({
  name: "[HAPPY-PATH] I can read stdin from a reader.",
  async fn() {
    const proc = procgroup();
    try {
      const result = await proc.run(
        ReaderInput(),
        StringOutput(),
        new ClosableStringReader("Hello,\nDeno."),
        { cmd: ["grep", "-P", "."] },
      );
      assertEquals(result, "Hello,\nDeno.");
    } finally {
      proc.close();
    }
  },
});
