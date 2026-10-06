import { ExitCodeError, run } from "@j50n/proc";

try {
  await run("sh", "-c", "echo partial; exit 3").lines.forEach(console.log);
} catch (error) {
  if (error instanceof ExitCodeError) {
    console.log(error.message);
    console.log(error.command, error.code);
  } else {
    throw error;
  }
}
