import { assertEquals, fail } from "../../deps-test.ts";
import { Group } from "../proc-group.ts";
import { ProcessExitError } from "../process-exit-error.ts";
import { stderrLinesToErrorMessage } from "../stderr-support.ts";
import { emptyInput } from "./empty.ts";
import { stringInput, stringOutput } from "./string.ts";

Deno.test({
  name:
    "[HAPPY-PATH] I can run a command with stdin specified as a string, and get the result as a string.",
  async fn() {
    /*
     * I am passing in some lines (split by line-feeds) to grep and verifying that the filtering works.
     */
    const proc = new Group();
    try {
      const result = await proc.run(
        stringInput(),
        stringOutput(stderrLinesToErrorMessage(20)),
        "a\nb\nbc\nd\n",
        { cmd: ["grep", "b"] },
      );
      assertEquals(result, "b\nbc");
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[ERROR] If a process exits with a code that indicates failure, I get an error.",
  async fn() {
    const proc = new Group();
    try {
      try {
        await proc.run(
          emptyInput(),
          stringOutput(stderrLinesToErrorMessage(20)),
          undefined,
          { cmd: ["bash", "-c", "exit 17"] },
        );
        fail("expected an error to be thrown");
      } catch (e) {
        if (e instanceof ProcessExitError) {
          assertEquals(e.code, 17);
        } else {
          fail(`wrong error type: ${e}`);
        }
      }
    } finally {
      proc.close();
    }
  },
});
