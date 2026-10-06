import { run, TimeoutError } from "@j50n/proc";

try {
  await run({ timeoutMs: 200 }, "sleep", "5").lines.collect();
} catch (error) {
  if (error instanceof TimeoutError) console.log(error.message);
  else throw error;
}
