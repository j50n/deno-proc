#!/usr/bin/env -S deno run --quiet
import "https://deno.land/x/humanizer@1.1/romanNumerals.ts";
import "https://deno.land/x/humanizer@1.1/numberToWords.ts";
import { asynciter } from "https://deno.land/x/asynciter@0.0.7/mod.ts";
import { readerToBytesUnbuffered, toLines } from "../../mod.ts";
import { Answer, Question } from "./common-json-defs.ts";

for await (
  const question of asynciter(toLines(readerToBytesUnbuffered(Deno.stdin))).map(
    (line: string): Question => JSON.parse(line),
  )
) {
  const n = question.n;
  console.error(`humanize errors process question: ${n}`);
  const answer: Answer = {
    n: question.n,
    roman: (n).toRoman(),
    words: (n).toWords(),
  };
  console.log(JSON.stringify(answer));
}

console.error("humanize-numbers process done (normal exit)");
