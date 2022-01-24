import {
  BytesOutput,
  EmptyInput,
  Proc,
  proc,
  procgroup,
  StringInput,
  StringOutput,
} from "./mod.ts";

Deno.test({
  name: "README: Key Concepts | Leaking Resources",
  async fn() {
    const pg = procgroup();
    try {
      console.log(
        await proc(EmptyInput(), StringOutput()).run(pg, {
          cmd: ["ls", "-la"],
        }),
      );
    } finally {
      pg.close();
    }
  },
});

Deno.test({
  name: "README: Input and Output Types",
  async fn() {
    /**
     * Use `gzip` to compress some text.
     * @param text The text to compress.
     * @return The text compressed into bytes.
     */
    async function gzip(text: string): Promise<Uint8Array> {
      const pg = procgroup();
      try {
        /* I am using a string for input and a Uint8Array (bytes) for output. */
        const processDef: Proc<string, Uint8Array> = proc(
          StringInput(),
          BytesOutput(),
        );

        return await processDef.run(pg, {
          cmd: ["gzip", "-c"],
        }, text);
      } finally {
        pg.close();
      }
    }

    const pg = procgroup();
    try {
      console.dir(await gzip("Hello, world."));
    } finally {
      pg.close();
    }
  },
});
