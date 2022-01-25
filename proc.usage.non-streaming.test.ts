import { assertEquals } from "./deps-test.ts";
import {
  BytesInput,
  BytesOutput,
  proc,
  ProcGroup,
  StringInput,
  StringOutput,
} from "./mod.ts";
import { randomString } from "./runners/utility.ts";

async function gzip(text: string): Promise<Uint8Array> {
  const pg = new ProcGroup();
  try {
    return await proc(StringInput(), BytesOutput()).run(pg, {
      cmd: ["gzip", "-c"],
    }, text);
  } finally {
    pg.close();
  }
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const pg = new ProcGroup();
  try {
    return await proc(BytesInput(), StringOutput()).run(pg, {
      cmd: ["gzip", "-cd"],
    }, bytes);
  } finally {
    pg.close();
  }
}

Deno.test({
  name: "[USAGE] I can compress and decompress data using gzip, non-streaming.",
  async fn() {
    const expected = "Hello, world.";
    assertEquals(await gunzip(await gzip(expected)), expected);
  },
});

Deno.test({
  name:
    "[USAGE] I can compress and decompress data using gzip, non-streaming. Large data.",
  async fn() {
    const expected = randomString(1_000_000);
    assertEquals(await gunzip(await gzip(expected)), expected);
  },
});
