import { enumerate } from "../../mod.ts";
import { assertEquals } from "@std/assert";

Deno.test({
  name: "Splitting by Line consumes both '\\n' and '\\r'",
  async fn() {
    const text = "hello\r\nworld";
    const answer = await enumerate([new TextEncoder().encode(text)]).lines
      .collect();
    assertEquals(
      answer,
      ["hello", "world"],
      "line separator has been completely stripped",
    );
  },
});
