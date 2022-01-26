import { StringReader } from "../../deps.ts";
import { assertEquals } from "../../deps-test.ts";
import { procGroup } from "../proc-group.ts";
import { readerInput } from "./reader.ts";
import { stringOutput } from "./string.ts";

Deno.test({
  name: "[HAPPY-PATH] I can read stdin from a reader.",
  async fn() {
    const proc = procGroup();
    try {
      const result = await proc.run(
        readerInput(),
        stringOutput(),
        new StringReader("Hello,\nDeno."),
        { cmd: ["grep", "-P", "."] },
      );
      assertEquals(result, "Hello,\nDeno.");
    } finally {
      proc.close();
    }
  },
});
