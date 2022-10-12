#!/usr/bin/env -S deno run --quiet --allow-run='humanize-numbers.ts'

import { Answer, Question } from "./common-json-defs.ts";
import * as proc from "../../mod.ts";
import { asynciter } from "https://deno.land/x/asynciter@0.0.15/mod.ts";
import { blue, red } from "https://deno.land/std@0.159.0/fmt/colors.ts";

/**
 * This demonstrates sending objects to and receiving objects from a child process
 * using JSON, and with push input and pull output.
 *
 * This shows how you can use `proc` to implement a worker using child processes.
 */

const it = new proc.PushIterable<Question>();

/*
 * Write "questions" to the push-iterable.
 *
 * This is implemented as an asynchronous iffe, and there is no check to
 * ensure that this finishes before the program exits. It will finish before
 * the program exits - because the next step will completely consume all the
 * writes from the push-iterable.
 *
 * We are writing a message about each question colored blue to stderr.
 *
 * The sleep simulates an arbitrary load. These messages could come from
 * several sources, including events.
 */
(async () => {
  try {
    for (let n = 1; n <= 3; n++) {
      console.error(blue(`I am asking about ${n}.`));

      const question: Question = { n };
      await it.write(question);

      await proc.sleep(1000);
    }
  } finally {
    it.close();
  }
})();

/*
 * Consume the push iterable with the child process `humanize-numbers.ts`.
 *
 * stderr from the child process is written out in red.
 *
 * The "answers" from the child process are on stdout.
 *
 * The child process will process questions until the push-iterable
 * is exhausted (closed), and then it will shut down normally.
 */
for await (
  const answer: Answer of asynciter(
    proc.runner(
      proc.stringAsyncIterableUnbufferedInput(),
      proc.stringAsyncIterableUnbufferedOutput(async (stderrLines) => {
        for await (const line of proc.bytesToTextLines(stderrLines)) {
          console.error(red(line));
        }
      }),
    )().run(
      { cmd: ["humanize-numbers.ts"] },
      asynciter(it).map(JSON.stringify),
    ),
  ).map(JSON.parse)
) {
  console.dir(answer);
}
