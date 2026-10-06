import { assertEquals, assertRejects } from "@std/assert";
import { run } from "../../mod.ts";

Deno.test("An async fnError's throw reaches the consumer.", async () => {
  await assertRejects(
    () =>
      run(
        {
          fnError: async (error) => {
            await Promise.resolve();
            throw new Error("from the handler", { cause: error });
          },
        },
        "false",
      ).lines.collect(),
    Error,
    "from the handler",
  );
});

Deno.test("An async fnError that returns suppresses the error.", async () => {
  const lines = await run(
    { fnError: async () => await Promise.resolve() },
    "sh",
    "-c",
    "echo out; exit 1",
  ).lines.collect();
  assertEquals(lines, ["out"]);
});
