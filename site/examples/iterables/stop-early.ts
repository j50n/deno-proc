import { run } from "@j50n/proc";

// A step that returns before its input ends closes the source behind it.
async function* untilEnd(lines: AsyncIterable<string>) {
  for await (const line of lines) {
    if (line === "END") return;
    yield line;
  }
}

const lines = await run("sh", "-c", "echo a; echo b; echo END; echo c; exit 3")
  .lines
  .transform(untilEnd)
  .collect();
console.log(lines); // no error: the exit code isn't checked after an early stop
