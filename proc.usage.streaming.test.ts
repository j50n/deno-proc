import { asynciter } from "./deps-test.ts";
import * as proc from "./mod.ts";

async function* counter(): AsyncIterableIterator<number> {
  let c = 0;
  while (true) {
    yield c;
    c += 1;
  }
}

Deno.test({
  name:
    "[EDGE-CASE] A process with infinite string input works correctly and without errors.",
  async fn() {
    const p = proc.runner(
      proc.stringIterableInput(),
      proc.stringIterableOutput(),
    );

    const pg = proc.group();
    try {
      await asynciter(
        p.run(
          pg,
          { cmd: ["head", "-n", "3"] },
          asynciter(counter()).map((n) => `${n}`),
        ),
      ).forEach((n) => console.log(n));
    } finally {
      pg.close();
    }
  },
});

Deno.test({
  name:
    "[EDGE-CASE] A process with infinite byte input works correctly and without errors.",
  async fn() {
    const p = proc.runner(
      proc.bytesIterableInput(),
      proc.stringIterableOutput(),
    );

    const pg = proc.group();
    try {
      await asynciter(
        p.run(
          pg,
          { cmd: ["head", "-n", "3"] },
          asynciter(counter()).map((n) => `${n}\n`).map((n) =>
            new TextEncoder().encode(n)
          ),
        ),
      ).forEach((n) => console.log(n));
    } finally {
      pg.close();
    }
  },
});
