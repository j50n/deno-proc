import { ExitCodeError, run, UpstreamError } from "@j50n/proc";

/** One line per error in the cause chain. */
function chain(error: unknown): string[] {
  const lines: string[] = [];
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e instanceof ExitCodeError) {
      lines.push(`${e.name}: ${e.command[0]} exited with ${e.code}`);
    } else if (e instanceof UpstreamError) {
      lines.push(`${e.name}: thrown by ${e.command[0]}`);
    } else {
      lines.push(`${e.name}: ${e.message}`);
    }
  }
  return lines;
}

// The first command fails; the last one succeeds.
try {
  await run("sh", "-c", "echo data; exit 2").run("cat").lines.collect();
} catch (error) {
  console.log(chain(error));
}

// Both fail: grep finds nothing in the empty input and exits 1.
try {
  await run("sh", "-c", "exit 2").run("grep", "data").lines.collect();
} catch (error) {
  console.log(chain(error));
}
