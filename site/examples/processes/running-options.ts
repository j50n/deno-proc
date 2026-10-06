import { run } from "@j50n/proc";

await Deno.mkdir("reports", { recursive: true });
await Deno.writeTextFile("reports/q3.txt", "");

const line = await run(
  { cwd: "reports", env: { REGION: "west" } },
  "sh",
  "-c",
  'echo "$REGION: $(ls)"',
).lines.first;

console.log(line);
