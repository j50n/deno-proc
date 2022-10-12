#!/usr/bin/env -S deno run --quiet --allow-run=gunzip,sort,uniq,grep,wc

import { asynciter } from "https://deno.land/x/asynciter@0.0.15/mod.ts";
import * as proc from "../../mod.ts";

/**
 * This is a complete example.
 *
 * It demonstrates input and output using both text and byte arrays,
 * and also how to use a reader as input (for `Deno.stdin` in this case).
 * It also shows how you can use JavaScript to do some of the work
 * (the lowercase conversion).
 */

try {
  /*
     * `stdin` will be from a gzipped text file. So the first thing we need to do is
     * decompress it.
     *
     * Since I am passing the output directly to the next process, I am passing the data
     * in byte form (actually `Uint8Array`) in order to avoid the overhead of text conversions.
     */
  const uncompressedDoc = proc.runner(
    proc.readerInput(),
    proc.bytesAsyncIterableOutput(),
  )().run(
    {
      cmd: ["gunzip"],
    },
    Deno.stdin,
  );

  /*
   * `grep` to split the document roughly into words.
   */
  const rawWords = proc.runner(
    proc.bytesAsyncIterableInput(),
    proc.bytesAsyncIterableOutput(),
  )().run(
    {
      cmd: ["grep", "-o", "-E", "(\\w|')+"],
    },
    uncompressedDoc,
  );

  /*
   * `grep` again to remove words that start with a digit, because that's a number.
   */
  const nonNumericWords = proc.runner(
    proc.bytesAsyncIterableInput(),
    proc.stringAsyncIterableOutput(),
  )().run(
    {
      cmd: ["grep", "-v", "-P", "^\\d"],
    },
    rawWords,
  );

  /*
   * Convert to lowercase using JavaScript.
   *
   * In the shell-script version, I used `tr '[:upper:]' '[:lower:]'`.
   *
   * The JavaScript method is more accurate than the lowercase in `tr`,
   * and the difference in accuracy makes the counts slightly different.
   */
  const lowercaseWords = asynciter(nonNumericWords).map((w) =>
    w.toLocaleLowerCase()
  );

  /*
   * Now we have to sort - because `uniq`, which is the next step, requires sorted data.
   */
  const sortedWords = proc.runner(
    proc.stringAsyncIterableInput(),
    proc.bytesAsyncIterableOutput(),
  )().run(
    { cmd: ["sort"] },
    lowercaseWords,
  );

  /*
   * Remove duplicate words.
   */
  const uniqWords = proc.runner(
    proc.bytesAsyncIterableInput(),
    proc.bytesAsyncIterableOutput(),
  )().run(
    { cmd: ["uniq"] },
    sortedWords,
  );

  /*
   * `wc -l` counts the lines in the input. At this point, there is one unique, non-numeric word per line.
   * The first line of output is the count from `wc`. I grab this line and convert it to integer.
   */
  const countOfWords = parseInt(
    (await proc.runner(
      proc.bytesAsyncIterableInput(),
      proc.stringArrayOutput(),
    )()
      .run(
        { cmd: ["wc", "-l"] },
        uniqWords,
      ))[0],
    10,
  );

  console.log(`${countOfWords}`);
} catch (e) {
  console.dir(e);
  Deno.exit(1);
}
