#!/usr/bin/env -S deno run --allow-run --allow-read

/*
 * This is very cool, and I don't yet understand it fully.
 *
 * I am trying as hard as I can to make this leak processes. It is not cooperating.
 *
 * This is exciting. I thought it would leak because I am using stream-to-iterators
 * and iterators-to-streams through async calls all over the place. It is cleaning
 * up the processes automatically for me!
 *
 * You can see after I exit the for-loop early, it continues to print lines from
 * the processes that are still catting data forward. But this very quickly
 * resolves itself backwards. Despite being several iterators deep between streams,
 * the streams are closing backward until they reach all the way back and close
 * the gzip stream.
 *
 * This is remarkable. How does V8 do this? How does Deno do this? It seems to have a
 * systematic way of recognizing, through all these async calls, that the source iterator
 * is not needed anymore. It can't be GC - this is too fast, and it seems to be following
 * the timing of my sleep call.
 *
 * The head is set to 300 lines, and it is definitely not processing through
 * that much. Also, you can watch the end using `top` and see the processes closing
 * as the messages stop coming through. It is not all at once, but rolling backward.
 *
 * This means I may not have to have a manual "close" mechanism wrapping the
 * processes. That is huge for the usability of the API. Very cool!
 *
 * I don't know how to make this leak process resources, and I thought it would
 * be easy.
 *
 * ---
 *
 * Also very cool to watch it run. You can see `cat` passing through each packet
 * as it arrives, unbuffered. However, the first stuff does not come out of `head`
 * for a while. It is re-buffering.
 *
 * I have not taken this level of control over the pipes before. It is cool to
 * be able to see this!
 */

import { sleep } from "../legacy/runners/utility.ts";
import { enumerate, toLines } from "../mod3.ts";
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
    let count = 0;
    for await (const lines of toLines(input)) {
      /*
       * Line-oriented text is represented in this library as `string[]`, not `string`. This
       * is because, for performance reasons, you usually want to keep the line groups together.
       *
       * This deals with the small overhead of a promise per line, but more importantly, you
       * don't end up sending one line at a time to the stdin of a process. Sending data to a
       * process thunks down to the OS layer, which is a heavy operation.
       *
       * Also, this treats a `string` and a `Uint8Array` the same way. If you are passing plain
       * `string` data, we don't add a line feed between each one. If you use `string[]` or
       * `Uint8Array[]`, we add line feeds. It is a consistent way to do it.
       */
      for (const line of lines) {
        await sleep(1000);
        count += 1;
        console.error(
          colors.gray(
            `${new Date().toISOString()} ${
              count.toString().padStart(3, "0")
            } ${label} `,
          ),
        );

        /* I wrap the line (`string`) into an array so it will have a line-feed automatically added on conversion. */
        yield [line];
      }
    }
  }

  return transform;
}

let count = 0;

OUTER:
for await (
  const lines of enumerate(file.readable)
    .run("gunzip").transform(test("A gunzip"))
    .filter((line) =>
      /* Every other line is whitespace. Boring. */
      line.join("").trim().length > 0
    )
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

console.error(colors.red("Waiting 60 seconds..."));
/*
 * The wait period is necessary to show the cleanup behavior. The underlying processes
 * continue to process data until they figure out they are no longer needed and automagically
 * close.
 */
await sleep(60000);
console.error(colors.red("Done."));
