# Use `PushIterable` to Implement Workers

`proc` can be used to manage persistent child processes that accept messages
from your parent process and respond back with messages of their own. In order
to "push" messages to a process, you need to use a
[PushIterable](../../runners/push-iterable.ts). This technique is simlar to web
workers but with fewer limitations.

Note that this isn't limited to processes that run Deno, even though that is our
example. You could just as easily run something like `grep` or `awk` or
something written in Python as a child process that is managed this way.

## Run the Example

This example amends the `PATH` temporarily to add the current folder.

```sh
cd ./examples/pushiterable/
PATH=".:$PATH" ./example-of-pushiterable.ts
```

## `example-of-pushiterable.ts`

In this example, I am going to set up a child process that lets me ask a
"question" and get back an "answer." The question is a number `n`, and the
answer includes the number in roman-numeral format and written out in English.
Data is passed to and from the child process via JSON messages.

[example-of-pushiterable.ts](./example-of-pushiterable.ts)

```ts
import { Answer, Question } from "./common-json-defs.ts";
import * as proc from "https://deno.land/x/proc/mod.ts";
import { asynciter } from "https://deno.land/x/asynciter/mod.ts";
import { blue, red } from "https://deno.land/std/fmt/colors.ts";

const it = new proc.PushIterable<Question>();

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

for await (
  const answer: Answer of asynciter(
    proc.runner(
      proc.stringIterableUnbufferedInput(),
      proc.stringIterableUnbufferedOutput(async (stderrLines) => {
        for await (const line of stderrLines) {
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
```

## `humanize-numbers.ts`

The child process converts stdin to `Question` instances (unbuffered IO), does
some conversion, and writes the `Answer`s out to `stdout` (that is where
`console.log()` goes).

[humanize-numbers.ts](./humanize-numbers.ts)

```ts
import "https://deno.land/x/humanizer/romanNumerals.ts";
import "https://deno.land/x/humanizer/numberToWords.ts";
import { asynciter } from "https://deno.land/x/asynciter/mod.ts";
import {
  readerToBytesUnbuffered,
  toLines,
} from "https://deno.land/x/proc/mod.ts";
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
```
