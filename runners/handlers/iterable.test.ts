import { assertEquals, asyncIter } from "../../deps-test.ts";
import { ProcessGroup } from "../process-group.ts";
import { stderrLinesToErrorMessage } from "../stderr-support.ts";
import { StringIterableInput, StringIterableOutput } from "./iterable.ts";

Deno.test({
  name:
    "I can run a command with stdin as an AsyncIterable of text lines, and get the result as an AsyncIterable of text lines.",
  async fn() {
    /*
     * I am passing some numbers as test to `grep` and using it to filter out just a few.
     * I am using `asynciter` to transform to and from numbers.
     */
    const proc = new ProcessGroup();
    try {
      const stdout = await proc.run(
        new StringIterableInput(),
        new StringIterableOutput(stderrLinesToErrorMessage(20)),
        asyncIter([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).map((n) => `${n}`),
        { cmd: ["grep", "1"] },
      );
      assertEquals(
        await asyncIter(stdout).map((line) => parseInt(line, 10)).collect(),
        [1, 10, 11],
      );
    } finally {
      proc.close();
    }
  },
});
