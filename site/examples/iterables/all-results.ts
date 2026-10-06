import { enumerate, ExitCodeError, run } from "@j50n/proc";

// Catch inside the callback to let every job finish and report each one.
const checks = [["true"], ["sh", "-c", "exit 3"], ["echo", "fine"]];

const results = await enumerate(checks)
  .concurrentMap(async ([cmd, ...args]) => {
    try {
      await run(cmd, ...args).collect();
      return `${cmd}: ok`;
    } catch (error) {
      if (error instanceof ExitCodeError) return `${cmd}: exit ${error.code}`;
      throw error;
    }
  })
  .collect();

console.log(results);
