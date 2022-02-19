#!/usr/bin/env -S deno run --quiet --allow-run=bash,gunzip

import { asynciter } from "https://deno.land/x/asynciter@0.0.7/mod.ts";
import * as proc from "../../mod.ts";

/* Chain errors. */
proc.enableChaining(true);

/**
 * This is a better implementation.
 *
 * I am using `bash` to manage some of the pipes. This cleans up the
 * code, but it also shifts that processing out of my Deno process.
 *
 * I added a redundant `sort|uniq` after the greps. This makes the code
 * run several times faster than the first Typescript version, and almost
 * as fast as the pure shell version.
 */

try {
  /*
   * Bash squashes errors that occur in pipes. I really want to trap an error that
   * occurs in my gzip uncompress call, indicating bad data. That way, I can exit
   * my Deno process with an error. So I need to run gzip by itself.
   *
   * This is the kind of thing you realize when you actually run the code.
   */
  const uncompressedText = proc.runner(
    proc.readerInput(),
    proc.bytesAsyncIterableOutput(proc.stderrLinesToErrorMessage(20)),
  )().run({ cmd: ["gunzip"] }, Deno.stdin);

  const nonNumericWords = proc.runner(
    proc.bytesAsyncIterableInput(),
    proc.stringAsyncIterableOutput(),
  )().run(
    {
      cmd: [
        "bash",
        "-c",
        `cat - | grep -o -E "(\\w|')+" | grep -v -P '^\\d' | sort | uniq `,
      ],
    },
    uncompressedText,
  );

  /*
   * Convert the words to lowercase in-process.
   */
  const lowercaseWords = asynciter(nonNumericWords).map((w) =>
    w.toLocaleLowerCase()
  );

  const wordCount = parseInt(
    (
      await proc.runner(
        proc.stringAsyncIterableInput(),
        proc.stringArrayOutput(),
      )().run(
        {
          cmd: [
            "bash",
            "-c",
            `cat - | sort | uniq | wc -l `,
          ],
        },
        lowercaseWords,
      )
    )[0],
    10,
  );

  console.log(`${wordCount}`);
} catch (e) {
  console.dir(e);
  Deno.exit(1);
}
