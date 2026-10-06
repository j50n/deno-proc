import { ExitCodeError, run } from "@j50n/proc";

try {
  await run("sh", "-c", "echo one; echo two; exit 3")
    .lines
    .forEach((line) => console.log(line));
} catch (error) {
  if (error instanceof ExitCodeError) {
    console.log(`failed with exit code ${error.code}`);
  } else {
    throw error;
  }
}
