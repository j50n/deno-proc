import { MINUTES, SECONDS, sleep } from "@j50n/proc";

console.log(`${5 * MINUTES} ms in five minutes`);

// Retry a flaky step, waiting longer each time.
let attempts = 0;
async function flaky() {
  attempts += 1;
  await sleep(1); // stands in for the real work
  if (attempts < 3) throw new Error("not yet");
  return "ok";
}

for (let wait = 0.01 * SECONDS;; wait *= 2) {
  try {
    console.log(`${await flaky()} after ${attempts} attempts`);
    break;
  } catch {
    await sleep(wait);
  }
}
