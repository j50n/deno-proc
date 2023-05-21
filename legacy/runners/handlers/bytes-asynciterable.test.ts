import { assertEquals } from "../../deps-test.ts";
import { group } from "../proc-group.ts";
import {
  bytesAsyncIterableInput,
  bytesAsyncIterableOutput,
  bytesAsyncIterableUnbufferedInput,
  bytesAsyncIterableUnbufferedOutput,
} from "./bytes-asynciterable.ts";
import { emptyInput } from "./empty.ts";
import { stringOutput } from "./string.ts";

Deno.test({
  name:
    "[HAPPY-PATH] I can connect processes together with AsyncIterable<Uint8Array>.",
  async fn() {
    /*
     * I am compressing some text with gzip, then uncompressing it. There are three
     * external processes being orchestrated here.
     */
    const proc = group();
    try {
      const out1 = await proc.run(
        emptyInput(),
        bytesAsyncIterableOutput(),
        undefined,
        { cmd: ["bash", "-c", "echo 'Hello, world.'"] },
      );
      const out2 = await proc.run(
        bytesAsyncIterableInput(),
        bytesAsyncIterableOutput(),
        out1,
        { cmd: ["gzip", "-c"] },
      );
      const out3 = await proc.run(
        bytesAsyncIterableInput(),
        stringOutput(),
        out2,
        {
          cmd: ["gzip", "-cd"],
        },
      );

      assertEquals(out3, "Hello, world.");
    } finally {
      proc.close();
    }
  },
});

Deno.test({
  name:
    "[HAPPY-PATH] I can connect processes together with AsyncIterable<Uint8Array>, unbuffered.",
  async fn() {
    const proc = group();
    try {
      const out1 = await proc.run(
        emptyInput(),
        bytesAsyncIterableUnbufferedOutput(),
        undefined,
        { cmd: ["bash", "-c", "echo 'Hello, world.'"] },
      );
      const out2 = await proc.run(
        bytesAsyncIterableUnbufferedInput(),
        bytesAsyncIterableUnbufferedOutput(),
        out1,
        { cmd: ["gzip", "-c"] },
      );
      const out3 = await proc.run(
        bytesAsyncIterableUnbufferedInput(),
        stringOutput(),
        out2,
        {
          cmd: ["gzip", "-cd"],
        },
      );

      assertEquals(out3, "Hello, world.");
    } finally {
      proc.close();
    }
  },
});
