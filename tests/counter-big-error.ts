#!/usr/bin/env -S deno run --quiet

/**
 * 0 to 999,999 written to stdout, write an error message to stderr, and exit with an error code.
 */
try {
  let counter = 0;
  for (let i = 0; i < 1_000_000; i++) {
    console.info(`${i}`);
    counter++;
  }
  console.error("an error occurred " + counter);
  Deno.exit(42);
} catch (e) {
  if (e.name === "BrokenPipe") {
    // Do nothing.
  } else {
    throw e;
  }
}
