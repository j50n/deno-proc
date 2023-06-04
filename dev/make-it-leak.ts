#!/usr/bin/env -S deno run --allow-run --allow-read

/*
 * This is very cool, and I don't yet understand it fully.
 *
 * I am trying as hard as I can to make this leak processes. It is not cooperating.
 *
 * You can see after I exit the for-loop early, it continues to print lines from
 * the processes that are still catting data forward. But this very quickly
 * resolves itself backwards. Despite being several iterators deep between streams,
 * the streams are closing backward until they reach all the way back and close
 * the gzip stream.
 *
 * This is remarkable. How does V8 do this? It seems to have a systematic way
 * of recognizing, through all these async calls, that the source iterator is not
 * needed anymore. It can't be GC - this is too fast, and it seems to be following
 * the timing of my sleep call.
 *
 * This means I may not have to have a manual "close" mechanism wrapping the
 * processes. That is huge for the usability of the API. Very cool!
 *
 * I don't know how to make this leak process resources, and I thought it would
 * be easy.
 */

import { sleep } from "../legacy/runners/utility.ts";
import { runnable, toLines } from "../mod3.ts";
import { colors, path } from "./deps.ts";

const file = await Deno.open(
  path.fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
);

/*
 * Good example of a complex parameterized transform. This is so much better than
 * stream transforms. I can't even...
 */
function test(
  label: string,
): (input: AsyncIterable<Uint8Array>) => AsyncIterable<string[]> {
  async function* transform(
    input: AsyncIterable<Uint8Array>,
  ): AsyncIterable<string[]> {
    for await (const lines of toLines(input)) {
      for (const line of lines) {
        await sleep(500);
        console.error(colors.gray(label));
        yield [line];
      }
    }
  }

  return transform;
}

let count = 0;

OUTER:
for await (
  const lines of runnable(file.readable)
    .run("gunzip").transform(test("A gunzip"))
    .filter((line) =>
      line.join("").trim().length > 0
    ) /* Every other line is whitespace. Boring. */
    .run("cat").transform(test("B cat"))
    .run("cat").transform(test("C cat"))
    .run("cat").transform(test("D cat"))
    .run("head", "-n", "300").transform(test("E head"))
    .run("cat").transform(test("F cat"))
    .run("cat").transform(test("G cat"))
    .run("cat").transform(test("H cat"))
) {
  for (const line of lines) {
    count += 1;
    console.log(`${colors.blue(`${count}`)}: ${colors.cyan(line)}`);

    if (count >= 10) {
      break OUTER;
    }
  }
}

console.error("Waiting 60 seconds...");
await sleep(60000);
