import { StringReader } from "../../deps.ts";
import { assertEquals } from "../../deps-test.ts";
import { group } from "../proc-group.ts";
import { readerInput, readerUnbufferedInput } from "./reader.ts";
import { stringOutput } from "./string.ts";

Deno.test({
  name: "[HAPPY-PATH] I can read stdin from a reader.",
  async fn() {
    const proc = group();
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

Deno.test({
  name: "[HAPPY-PATH] I can read stdin from a reader, unbuffered.",
  async fn() {
    const proc = group();
    try {
      const result = await proc.run(
        readerUnbufferedInput(),
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
