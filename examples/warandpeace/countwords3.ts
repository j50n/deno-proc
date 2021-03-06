#!/usr/bin/env -S deno run --quiet --allow-run=gunzip,sort,uniq,grep,wc

import * as proc from "../../mod.ts";

/**
 * This is a rewrite of the first example, but using non-streaming mode, just for fun.
 */

try {
  console.error(`${new Date()} Starting.`);

  const uncompressedDoc = await proc.runner(
    proc.readerInput(),
    proc.stringOutput(),
  )().run(
    {
      cmd: ["gunzip"],
    },
    Deno.stdin,
  );

  console.error(
    `${new Date()} The document is ${uncompressedDoc.length} bytes long.`,
  );

  const rawWords = await proc.runSa(
    {
      cmd: ["grep", "-o", "-E", "(\\w|')+"],
    },
    uncompressedDoc,
  );

  console.error(
    `${new Date()} There are ${rawWords.length} words in the document.`,
  );

  const nonNumericWords = await proc.runSa(
    {
      cmd: ["grep", "-v", "-P", "^\\d"],
    },
    rawWords,
  );

  console.error(
    `${new Date()} After removing numbers, there are ${nonNumericWords.length} words in the document.`,
  );

  const lowercaseWords = nonNumericWords.map((w) => w.toLocaleLowerCase());

  console.error(`${new Date()} Words are converted to lower case.`);

  const sortedWords = await proc.runSa(
    { cmd: ["sort"] },
    lowercaseWords,
  );

  console.error(`${new Date()} Words are sorted alphabetically.`);

  const uniqWords = await proc.runSa(
    { cmd: ["uniq"] },
    sortedWords,
  );

  console.error(
    `${new Date()} There are ${uniqWords.length} unique words in the document.`,
  );

  const countOfWords = parseInt(
    (await proc.runSa(
      { cmd: ["wc", "-l"] },
      uniqWords,
    ))[0],
    10,
  );

  console.error(`${new Date()} Counted.`);
  console.log(`${countOfWords}`);
} catch (e) {
  console.dir(e);
  Deno.exit(1);
}
