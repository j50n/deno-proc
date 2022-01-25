import { assertEquals, asynciter } from "./deps-test.ts";
import {
  EmptyInput,
  Proc,
  ProcGroup,
  StringInput,
  StringIterableOutput,
  StringOutput,
} from "./mod.ts";

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
    const proc = new ProcGroup();
    try {
      const p1 = new Proc(StringInput(), StringIterableOutput()).run(
        proc,
        {
          cmd: ["grep", "b"],
        },
        "a\nb\nbb\nc\n",
      );

      assertEquals(await asynciter(p1).collect(), ["b", "bb"]);
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[TYPES] When the output is iterable, I get back an AsyncIterator without the Promise wrapper. Empty input, so I don't specify input.",
  async fn() {
    const proc = new ProcGroup();
    try {
      const p1 = new Proc(EmptyInput(), StringIterableOutput()).run(
        proc,
        {
          cmd: ["bash", "-c", "echo 'Hello.'"],
        },
      );

      assertEquals(await asynciter(p1).collect(), ["Hello."]);
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[TYPES] When the output is a string (not iterable), I get back a promise. Empty input so I don't specify input.",
  async fn() {
    const proc = new ProcGroup();
    try {
      const hello = await new Proc(EmptyInput(), StringOutput()).run(
        proc,
        {
          cmd: ["bash", "-c", "echo 'Hello.'"],
        },
      );

      assertEquals(hello, "Hello.");
    } finally {
      proc.close();
    }
  },
});
