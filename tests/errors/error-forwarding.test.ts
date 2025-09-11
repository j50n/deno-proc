import { fail } from "@std/assert";
import {
  enumerate,
  toBufferSource,
  toBytes,
  UpstreamError,
} from "../../mod.ts";
import { resolve } from "../../tools/deps/path.ts";

async function* testTransform(
  lines: AsyncIterable<string>,
): AsyncIterable<string> {
  let count = 0;
  for await (const line of lines) {
    if (count++ === 999) {
      throw new Deno.errors.NotSupported("By the nine!");
    }
    yield line;
  }
}

Deno.test(
  {
    name: "test of error forwarding through a streamed Transformer",
    sanitizeResources: true,
  },
  async () => {
    try {
      await enumerate(
        (await Deno.open(
          resolve(import.meta.dirname!, "..", "docs", "warandpeace.txt.gz"),
        )).readable,
      )
        .run("gunzip")
        .lines
        .transform(testTransform)
        .transform(toBufferSource)
        .transform(new CompressionStream("gzip"))
        .transform(toBytes)
        .run("gzip")
        .forEach(() => {});

      fail("no error caught; expected raised error to be caught");
    } catch (e) {
      if (e instanceof UpstreamError || e instanceof Deno.errors.NotSupported) {
        //Correct. Test passes.
      } else {
        console.log((e as Error).stack);
        fail(`error was ${(e as Error).name}; expected a NotSupported error`);
      }
    }
  },
);
