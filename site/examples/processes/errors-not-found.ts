import { read, run } from "@j50n/proc";

try {
  await run("no-such-program", "--version").lines.collect();
} catch (error) {
  if (error instanceof Deno.errors.NotFound) console.log(error.message);
}

try {
  await read("no-such-file.txt").lines.collect();
} catch (error) {
  if (error instanceof Deno.errors.NotFound) console.log(error.message);
}
