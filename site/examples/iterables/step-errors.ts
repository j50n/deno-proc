import { ExitCodeError, run } from "@j50n/proc";

// A step sees errors from upstream in its own loop, and can add context.
async function* numbered(lines: AsyncIterable<string>) {
  let n = 0;
  try {
    for await (const line of lines) {
      n += 1;
      yield `${n}: ${line}`;
    }
  } catch (error) {
    throw new Error(`input failed after line ${n}`, { cause: error });
  }
}

try {
  await run("sh", "-c", "echo a; echo b; exit 2")
    .lines
    .transform(numbered)
    .forEach((line) => console.log(line));
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
    if (error.cause instanceof ExitCodeError) {
      console.log(`cause: exit code ${error.cause.code}`);
    }
  }
}
