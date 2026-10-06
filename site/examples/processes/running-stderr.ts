import { run } from "@j50n/proc";

const out = await run("sh", "-c", "echo to stdout; echo to stderr >&2")
  .lines
  .collect();

console.log(out);
