import { main, run } from "@j50n/proc";

// Long-running workers, each output line tagged with the worker's name.
// (These stand-ins end after three ticks; real ones would run until stopped.)
const workers: Record<string, string> = {
  web: "for i in 1 2 3; do echo tick $i; sleep 0.05; done",
  queue: "for i in 1 2 3; do echo tick $i; sleep 0.05; done",
};

await main(async () => {
  await Promise.all(
    Object.entries(workers).map(([name, script]) =>
      run("sh", "-c", script).lines
        .forEach((line) => console.log(`[${name}] ${line}`))
    ),
  );
});
