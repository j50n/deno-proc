import { enumerate, UpstreamError } from "@j50n/proc";

function parse(line: string): number {
  const n = Number(line);
  if (Number.isNaN(n)) throw new Error(`not a number: ${line}`);
  return n;
}

// The callback's error arrives as it was thrown.
try {
  await enumerate(["1", "two", "3"]).map(parse).collect();
} catch (error) {
  if (error instanceof Error) console.log(`${error.name}: ${error.message}`);
}

// With a .run() after the callback, it is the cause of an UpstreamError.
try {
  await enumerate(["1", "two", "3"])
    .map(parse)
    .map((n) => `${n}`)
    .run("cat")
    .lines
    .collect();
} catch (error) {
  if (error instanceof UpstreamError && error.cause instanceof Error) {
    console.log(
      `${error.name} from ${error.command[0]}: ${error.cause.message}`,
    );
  }
}
