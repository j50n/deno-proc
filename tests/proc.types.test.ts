import { assertEquals, asynciter } from "../deps-test.ts";
import {
  emptyInput,
  group,
  runner,
  stringInput,
  stringIterableOutput,
  stringOutput,
} from "../mod.ts";

/**
 * Demonstrate the subtleties of type handling.
 *
 * - Input is optional and checked at runtime, as this is the best I can do with the limitations of optional parameters.
 * - When the output is an `AsyncIterable`, that is returned without the `Promise` wrapper.
 * - When the output is some other type, that is returned with a `Promise` wrapper.
 */

Deno.test({
  name:
    "[TYPES] When the output is iterable, I get back an AsyncIterator without the Promise wrapper. Input is a string, so I specify the string.",
  async fn() {
    const pg = group();
    try {
      const p1 = runner(stringInput(), stringIterableOutput())(pg).run(
        {
          cmd: ["grep", "b"],
        },
        "a\nb\nbb\nc\n",
      );

      assertEquals(await asynciter(p1).collect(), ["b", "bb"]);
    } finally {
      pg.close();
    }
  },
});

Deno.test({
  name:
    "[TYPES] When the output is iterable, I get back an AsyncIterator without the Promise wrapper. Empty input, so I don't specify input.",
  async fn() {
    const pg = group();
    try {
      const p1 = runner(emptyInput(), stringIterableOutput())(pg).run(
        {
          cmd: ["bash", "-c", "echo 'Hello.'"],
        },
      );

      assertEquals(await asynciter(p1).collect(), ["Hello."]);
    } finally {
      pg.close();
    }
  },
});

Deno.test({
  name:
    "[TYPES] When the output is a string (not iterable), I get back a promise. Empty input so I don't specify input.",
  async fn() {
    const pg = group();
    try {
      const hello = await runner(emptyInput(), stringOutput())(pg).run(
        {
          cmd: ["bash", "-c", "echo 'Hello.'"],
        },
      );

      assertEquals(hello, "Hello.");
    } finally {
      pg.close();
    }
  },
});
