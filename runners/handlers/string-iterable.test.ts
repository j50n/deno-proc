import { assertEquals, asynciter } from "../../deps-test.ts";
import { ProcGroup } from "../proc-group.ts";
import { stderrLinesToErrorMessage } from "../stderr-support.ts";
import {
  StringIterableInput,
  StringIterableOutput,
} from "./string-iterable.ts";

Deno.test({
  name:
    "I can run a command with stdin as an AsyncIterable of text lines, and get the result as an AsyncIterable of text lines.",
  async fn() {
    /*
     * I am passing some numbers as test to `grep` and using it to filter out just a few.
     * I am using `asynciter` to transform to and from numbers.
     */
    const proc = new ProcGroup();
    try {
      const stdout = await proc.run(
        StringIterableInput(),
        StringIterableOutput(stderrLinesToErrorMessage(20)),
        asynciter([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).map((n) => `${n}`),
        { cmd: ["grep", "1"] },
      );
      assertEquals(
        await asynciter(stdout).map((line) => parseInt(line, 10)).collect(),
        [1, 10, 11],
      );
    } finally {
      proc.close();
    }
  },
});
