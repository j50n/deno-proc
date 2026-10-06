import { main, run } from "@j50n/proc";

// Under Kubernetes' default 30-second grace period: give the children 25.
await main(async () => {
  await run("./long-job.sh").lines.forEach(console.log);
}, { timeoutMs: 25_000 });
