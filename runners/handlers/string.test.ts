import { assertEquals } from "../../deps-test.ts";
import { ProcGroup } from "../proc-group.ts";
import { stderrLinesToErrorMessage } from "../stderr-support.ts";
import { StringInput, StringOutput } from "./string.ts";

Deno.test({
  name:
    "I can run a command with stdin specified as a string, and get the result as a string.",
  async fn() {
    /*
     * I am passing in some lines (split by line-feeds) to grep and verifying that the filtering works.
     */
    const proc = new ProcGroup();
    try {
      const result = await proc.run(
        StringInput(),
        StringOutput(stderrLinesToErrorMessage(20)),
        "a\nb\nbc\nd\n",
        { cmd: ["grep", "b"] },
      );
      assertEquals(result, "b\nbc");
    } finally {
      proc.close();
    }
  },
});
