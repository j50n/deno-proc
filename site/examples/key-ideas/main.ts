import { main, run } from "@j50n/proc";

await main(async () => {
  await run("./long-job.sh").lines.toStdout();
});
