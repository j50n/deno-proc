import { enumerate, WritableIterable } from "@j50n/proc";

// A producer that calls back on a timer, as many event sources do.
const ticks = new WritableIterable<number>();
let n = 0;
const timer = setInterval(() => {
  n += 1;
  ticks.write(n);
  if (n === 3) {
    clearInterval(timer);
    ticks.close(); // without this, the loop below waits forever
  }
}, 10);

await enumerate(ticks)
  .map((tick) => `tick ${tick}`)
  .forEach((line) => console.log(line));
console.log("closed");
