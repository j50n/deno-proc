#!/usr/bin/env -S deno run --quiet --allow-run

import * as proc from "./mod.ts";
import { dirname } from "./runners/utility.ts";

const here = dirname(import.meta);

proc.run0({
  cmd: [
    "bash",
    "--login",
    "-c",
    `
set -e

cd "${here}/examples/warandpeace" && (
  set -x
  time ./countwords.sh < ./warandpeace.txt.gz
  time ./countwords.ts < ./warandpeace.txt.gz
  time ./countwords2.ts < ./warandpeace.txt.gz
  echo "a b c d" | ./countwords2.ts || true
  time ./countwords3.ts < ./warandpeace.txt.gz
  echo "a b c d" | ./countwords3.ts || true
)

cd "${here}/examples/pushiterable" && (
  PATH=".:$PATH" ./example-of-pushiterable.ts
)

cd "${here}/examples/sounds" && (
  ./sounds.ts
)
`,
  ],
});
