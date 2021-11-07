#!/usr/bin/env -S deno run --quiet

/**
 * 0 to 3 written to stdout.
 */
try {
  console.log("Something to stdout.");

  for (let i = 0; i < 4; i++) {
    console.error(`${i}`);
  }
} catch (e) {
  if (e.name === "BrokenPipe") {
    // Do nothing.
  } else {
    throw e;
  }
}
