import { assertEquals, fail } from "../../deps-test.ts";
import { group } from "../proc-group.ts";
import { ProcessExitError } from "../process-exit-error.ts";
import { stderrLinesToErrorMessage } from "../stderr-support.ts";
import { emptyInput } from "./empty.ts";
import { stringArrayInput, stringArrayOutput } from "./string-array.ts";
import * as proc from "../../mod.ts";

Deno.test({
  name:
    "[HAPPY-PATH] I can run a command with stdin specified as a string[], and get the result as a string[].",
  async fn() {
    /*
     * I am passing in some lines (split by line-feeds) to grep and verifying that the filtering works.
     */
    const proc = group();
    try {
      const result = await proc.run(
        stringArrayInput(),
        stringArrayOutput(stderrLinesToErrorMessage(20)),
        ["a", "b", "bc", "d"],
        { cmd: ["grep", "b"] },
      );
      assertEquals(result, ["b", "bc"]);
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[ERROR] If a process exits with a code that indicates failure, I get an error.",
  async fn() {
    const proc = group();
    try {
      try {
        await proc.run(
          emptyInput(),
          stringArrayOutput(stderrLinesToErrorMessage(20)),
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

Deno.test({
  name: "[README] I can write out big letters with figlet.",
  async fn() {
    const moo = await proc.runner(proc.emptyInput(), proc.stringArrayOutput())()
      .run({ cmd: ["figlet", "MOO!"] });

    console.log(moo.join("\n"));

    /*  __  __  ___   ___  _
     * |  \/  |/ _ \ / _ \| |
     * | |\/| | | | | | | | |
     * | |  | | |_| | |_| |_|
     * |_|  |_|\___/ \___/(_)
     */

    const cowSaysMoo = await proc.runner(
      stringArrayInput(),
      stringArrayOutput(),
    )().run({ cmd: ["cowsay", "-n"] }, moo);

    console.log(cowSaysMoo.join("\n"));

    /*
     *  ________________________
     * /  __  __  ___   ___  _  \
     * | |  \/  |/ _ \ / _ \| | |
     * | | |\/| | | | | | | | | |
     * | | |  | | |_| | |_| |_| |
     * | |_|  |_|\___/ \___/(_) |
     * \                        /
     *  ------------------------
     *         \   ^__^
     *          \  (oo)\_______
     *             (__)\       )\/\
     *                 ||----w |
     *                 ||     ||
     */
  },
});
