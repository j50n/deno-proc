#!/usr/bin/env -S deno run --allow-run --allow-read

/*
 * I tried my best to hack a process leak. This example shows the data
 * streaming through each of the processes, even how `head` buffers the input
 * again before putting out the first line. At the end, the messages trail
 * away backwards, closing down each process as the shutdown cascades through
 * the iterables. You can also open something like `top` on the side and watch
 * the processes disappear. It is pretty fascinating to watch this in slow
 * motion.
 */

import { fromFileUrl } from "jsr:@std/path@1.0.6";
import { enumerate, range, sleep, toLines } from "../mod.ts";
import { blue, cyan, gray, red } from "jsr:@std/fmt@1.0.2/colors";

const file = await Deno.open(
  fromFileUrl(import.meta.resolve("./warandpeace.txt.gz")),
);

/*
 * Good example of a complex parameterized transform. This is so much better than
 * stream transforms with `.pipeThrough()`. I can't even...
 */
function test(
  label: string,
): (input: AsyncIterable<Uint8Array>) => AsyncIterable<string> {
  async function* transform(
    input: AsyncIterable<Uint8Array>,
  ) {
    let count = 0;
    for await (const line of toLines(input)) {
      await sleep(500);
      count += 1;
      console.error(
        gray(
          `${new Date().toISOString()} ${
            count.toString().padStart(3, "0")
          } ${label} `,
        ),
      );

      yield line;
    }
  }

  return transform;
}

let count = 0;

OUTER:
for await (
  const line of enumerate(file.readable)
    .run("gunzip").transform(test("A gunzip"))
    .filter((line) =>
      /* Every other line is whitespace. Boring. Remove those. */
      line.trim().length > 0
    )
    .run("cat").transform(test("B cat"))
    .run("cat").transform(test("C cat"))
    .run("cat").transform(test("D cat"))
    .run("head", "-n", "300")
    .transform(test("E head"))
    .run("cat").transform(test("F cat"))
    .run("cat").transform(test("G cat"))
    .run("cat").transform(test("H cat"))
) {
  count += 1;
  console.log(`${blue(`${count}`)}: ${cyan(line)}`);

  if (count >= 10) {
    break OUTER;
  }
}

console.error(red("Waiting 60 seconds..."));
/*
 * The wait period is necessary to show the cleanup behavior. The underlying processes
 * continue to process data until they figure out they are no longer needed and automagically
 * close. At this point, I no longer have any control over what is going on, but it is
 * still going on.
 */

await range({ from: 60, until: 1, step: -1 }).forEach(async (i) => {
  await sleep(1000);
  console.error(`🐑 ${gray(`... ${i.toLocaleString()}`)}`);
});

console.error(red("Done."));
