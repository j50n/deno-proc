import { ExitCodeError, run } from "@j50n/proc";

/** grep, where exit code 1 ("no lines matched") is not an error. */
function grep(pattern: string, file: string): Promise<string[]> {
  return run(
    {
      fnError: (error) => {
        if (error instanceof ExitCodeError && error.code === 1) return;
        if (error) throw error;
      },
    },
    "grep",
    pattern,
    file,
  ).lines.collect();
}

console.log(await grep("WARN", "app.log"));
console.log(await grep("FATAL", "app.log"));

try {
  await grep("WARN", "missing.log"); // exit 2: a real failure
} catch (error) {
  if (error instanceof ExitCodeError) console.log(`exit ${error.code}`);
}

// When only the answer matters, `grep -q` prints nothing; ask the status.
const { success } = await run("grep", "-q", "ERROR", "app.log").status;
console.log(success);
