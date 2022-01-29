import { assert, asynciter } from "../deps-test.ts";
import * as proc from "../mod.ts";

/**
 * Counts up from 0 to infinity.
 */
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
    "[EDGE-CASE] A process with infinite byte input (encoded text lines, but bytes to us) works correctly and without errors.",
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
          /*
           * Note the LF in the map of the number.
           * Otherwise it just writes out one long line and never exits.
           * We don't have to do this in the line test, but with bytes, things are a little less well defined.
           */
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

Deno.test({
  name: "blah2",
  async fn() {
    const pr = proc.runner(
      proc.stringIterableInput(),
      proc.stringIterableOutput(),
    );

    const imNobody = asynciter([
      "I'm Nobody! Who are you?",
      "Are you – Nobody – too?",
      "Then there's a pair of us!",
      "Don't tell! they'd advertise – you know!",
      "",
      "How dreary – to be – Somebody!",
      "How public – like a Frog –",
      "To tell one's name – the livelong June –",
      "To an admiring Bog!",
    ]);

    const pg = proc.group();
    try {
      const rawWords = pr.run(
        pg,
        {
          cmd: ["grep", "-o", "-E", "(\\w|')+"],
        },
        imNobody,
      );

      /* I could also use `tr '[:upper:]' '[:lower:]' here. */
      const lowercaseWords = asynciter(rawWords).map((w) =>
        w.toLocaleLowerCase()
      );

      const sortedWords = pr.run(
        pg,
        { cmd: ["sort"] },
        lowercaseWords,
      );

      const uniqWords = pr.run(
        pg,
        { cmd: ["uniq"] },
        sortedWords,
      );

      const words = await asynciter(uniqWords).collect();

      assert(words.includes("how"));
      console.dir(words);
    } finally {
      pg.close();
    }
  },
});
