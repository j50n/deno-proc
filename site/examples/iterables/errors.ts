import { enumerate, sleep } from "@j50n/proc";

try {
  await enumerate(["a", "b", "c"])
    .concurrentMap(async (name) => {
      await sleep(name === "c" ? 100 : 10);
      if (name === "b") throw new Error(`${name} failed`);
      console.log(`${name} done`);
      return name;
    }, { concurrency: 3 })
    .forEach((name) => console.log(`got ${name}`));
} catch (error) {
  if (error instanceof Error) console.log(`caught: ${error.message}`);
}

// The error didn't stop "c", which was already running.
await sleep(200);
