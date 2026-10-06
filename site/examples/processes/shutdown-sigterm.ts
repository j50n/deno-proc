import { ExitCodeError, run, SignalError } from "@j50n/proc";

/** Run a program, send it SIGTERM once its service is ready, and report. */
async function stop(program: string) {
  console.log(program);
  const path = new URL(program, import.meta.url).pathname;
  const child = run(Deno.execPath(), "run", "--allow-run", path);
  try {
    for await (const line of child.lines) {
      console.log(`  ${line}`);
      if (line === "service: ready") Deno.kill(child.pid, "SIGTERM");
    }
  } catch (error) {
    if (error instanceof ExitCodeError) {
      console.log(`  exited with ${error.code}`);
    } else if (error instanceof SignalError) {
      console.log(`  killed by ${error.signal}`);
    } else {
      throw error;
    }
  }
  const lock = await Deno.readTextFile("service.lock").catch(() => undefined);
  console.log(`  lock file left behind: ${lock !== undefined}`);
  return lock;
}

await stop("shutdown-main.ts");

const orphan = await stop("shutdown-plain.ts");
if (orphan !== undefined) {
  // The service is still running, orphaned. Stop it ourselves.
  Deno.kill(Number(orphan), "SIGTERM");
}
