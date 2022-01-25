import {
  bytesOutput,
  emptyInput,
  Proc,
  proc,
  procGroup,
  stringInput,
  stringOutput,
} from "./mod.ts";

Deno.test({
  name: "[README] Key Concepts | Leaking Resources",
  async fn() {
    const pg = procGroup();
    try {
      console.log(
        await proc(emptyInput(), stringOutput()).run(pg, {
          cmd: ["ls", "-la"],
        }),
      );
    } finally {
      pg.close();
    }
  },
});

Deno.test({
  name: "[README] Input and Output Types",
  async fn() {
    /**
     * Use `gzip` to compress some text.
     * @param text The text to compress.
     * @return The text compressed into bytes.
     */
    async function gzip(text: string): Promise<Uint8Array> {
      const pg = procGroup();
      try {
        /* I am using a string for input and a Uint8Array (bytes) for output. */
        const processDef: Proc<string, Uint8Array> = proc(
          stringInput(),
          bytesOutput(),
        );

        return await processDef.run(pg, {
          cmd: ["gzip", "-c"],
        }, text);
      } finally {
        pg.close();
      }
    }

    const pg = procGroup();
    try {
      console.dir(await gzip("Hello, world."));
    } finally {
      pg.close();
    }
  },
});

Deno.test({
  name: "[README] Examples | Run an Inline Bash Script",
  async fn() {
    const pg = procGroup();
    try {
      console.log(
        await proc(emptyInput(), stringOutput()).run(pg, {
          cmd: [
            "/bin/bash",
            "--login",
            "-c",
            "echo 'Hello, Deno.'",
          ],
        }),
      );
    } finally {
      pg.close();
    }
  },
});
