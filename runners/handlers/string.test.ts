import { assertEquals } from "../../deps-test.ts";
import { ProcessGroup } from "../process-group.ts";
import { stderrLinesToErrorMessage } from "../stderr-support.ts";
import { StringInput, StringOutput } from "./string.ts";

Deno.test({
  name:
    "I can run a command with stdin specified as a string, and get the result as a string.",
  async fn() {
    /*
     * I am passing
     */
    const proc = new ProcessGroup();
    try {
      const result = await proc.run(
        new StringInput(),
        new StringOutput(stderrLinesToErrorMessage(20)),
        "a\nb\nc\n",
        { cmd: ["grep", "b"] },
      );
      assertEquals(result, "b");
    } finally {
      proc.close();
    }
  },
});
