#!/usr/bin/env -S deno run --quiet

/**
 * 0 to 3 written to stdout.
 */
try {
  for (let i = 0; i < 4; i++) {
    console.info(`${i}`);
  }
} catch (e) {
  if (e.name === "BrokenPipe") {
    // Do nothing.
  } else {
    throw e;
  }
}
