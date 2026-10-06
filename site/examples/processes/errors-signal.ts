import { run, SignalError } from "@j50n/proc";

try {
  // The shell kills itself, as the OOM killer or `kill -9` might.
  await run("sh", "-c", "echo started; kill -KILL $$").lines.forEach(
    console.log,
  );
} catch (error) {
  if (error instanceof SignalError) {
    console.log(`${error.command[0]} was killed by ${error.signal}`);
  } else {
    throw error;
  }
}
