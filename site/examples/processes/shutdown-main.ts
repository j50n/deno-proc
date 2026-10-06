import { main, run } from "@j50n/proc";

await main(async () => {
  await run("./processes-service.sh").lines.forEach(console.log);
});
