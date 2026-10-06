import { run } from "@j50n/proc";

// find succeeds and prints nothing when no file matches.
const find = ["find", ".", "-name", "*.bak"] as const;

try {
  console.log(await run(...find).lines.first);
} catch (error) {
  console.log(String(error));
}

const [path] = await run(...find).lines.take(1).collect();
console.log(path ?? "no backups");
