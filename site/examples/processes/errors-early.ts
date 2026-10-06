import { run } from "@j50n/proc";

// The command fails, but the consumer stopped before the end, so the exit
// code is never checked and nothing throws.
const first = await run("sh", "-c", "echo one; echo two; exit 1").lines.first;

console.log(first);
