import { run, terminateAll } from "@j50n/proc";

const service = run("./processes-service.sh");

for await (const line of service.lines) {
  console.log(line);
  if (line === "service: ready") {
    await terminateAll({ timeoutMs: 5_000 }); // SIGTERM, then wait for it
    console.log("terminateAll returned");
  }
}

const left = await Deno.stat("service.lock").then(() => true, () => false);
console.log(`lock file left behind: ${left}`);
