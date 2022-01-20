#!/usr/bin/env -S deno run --quiet

/**
 * 0 to 3 written to stdout, write an error message to stderr, and exit with an error code.
 */
try {
  for (let i = 0; i < 3; i++) {
    console.info(`${i}`);
  }
  console.error("an error occurred");
  Deno.exit(42);
} catch (e) {
  if (e.name === "BrokenPipe") {
    // Do nothing.
  } else {
    throw e;
  }
}
