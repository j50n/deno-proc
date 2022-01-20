#!/usr/bin/env -S deno run --quiet

/**
 * 0 to 999,999 written to stdout.
 */
try {
  for (let i = 0; i < 1_000_000; i++) {
    console.info(`${i}`);
  }
} catch (e) {
  if (e.name === "BrokenPipe") {
    // Do nothing.
  } else {
    throw e;
  }
}
