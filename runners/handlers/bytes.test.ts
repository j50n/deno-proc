import { assertEquals } from "https://deno.land/std@0.125.0/testing/asserts.ts";
import * as proc from "../../mod.ts";

Deno.test({
  name: "[README] I can compress and decompress byte arrays.",
  async fn() {
    const pg = proc.group();
    try {
      const pr = proc.runner(proc.bytesInput(), proc.bytesOutput())(pg);

      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const gzipped = await pr.run({ cmd: ["gzip", "-c"] }, original);
      console.dir(gzipped);
      const unzipped = await pr.run({ cmd: ["gzip", "-cd"] }, gzipped);

      assertEquals(unzipped, original);
    } finally {
      pg.close();
    }
  },
});
