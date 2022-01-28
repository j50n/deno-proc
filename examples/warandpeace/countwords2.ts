#!/usr/bin/env -S deno run --quiet --allow-run=bash

import { asynciter } from "https://deno.land/x/asynciter@0.0.7/mod.ts";
import * as proc from "../../mod.ts";

/**
 * This is a better implementation.
 *
 * I am using `bash` to manage some of the pipes. This cleans up the
 * code, but it also shifts that processing out of my Deno process.
 *
 * I added a redundant `sort|uniq` after the greps. This makes the code
 * run about 8 times faster than the first Typescript version, and almost
 * as fast as the pure shell version.
 */

const pg = proc.group();
try {
  const nonNumericWords = proc.runner(
    proc.readerInput(),
    proc.stringIterableOutput(),
  ).run(
    pg,
    {
      cmd: [
        "bash",
        "-c",
        `set -e
          cat - | gunzip | grep -o -E "(\\w|')+" | grep -v -P '^\\d' | sort | uniq `,
      ],
    },
    Deno.stdin,
  );

  const lowercaseWords = asynciter(nonNumericWords).map((w) =>
    w.toLocaleLowerCase()
  );

  const countOfWords = parseInt(
    await asynciter(
      proc.runner(
        proc.stringIterableInput(),
        proc.stringIterableOutput(),
      ).run(
        pg,
        {
          cmd: [
            "bash",
            "-c",
            `set -e
              cat - | sort | uniq | wc -l `,
          ],
        },
        lowercaseWords,
      ),
    ).first() || "0",
    10,
  );

  console.log(`${countOfWords}`);
} finally {
  pg.close();
}
