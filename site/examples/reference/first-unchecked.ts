import { run } from "@j50n/proc";

const cmd = ["sh", "-c", "echo partial; exit 3"] as const;

console.log(await run(...cmd).lines.first); // no error: the exit code is unread

try {
  await run(...cmd).lines.collect(); // reads to the end, so it checks
} catch (error) {
  console.log(String(error));
}
