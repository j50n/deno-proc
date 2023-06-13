#!/usr/bin/env -S deno run 

import { range } from "../mod3.ts";

/**
 * If you could count 1,000,000 times per second, it would take 285 years to
 * count from 0 to `Number.MAX_SAFE_INTEGER`.
 */

for await (const n of range({ to: Number.MAX_SAFE_INTEGER })) {
  console.log(n.toLocaleString());
}
