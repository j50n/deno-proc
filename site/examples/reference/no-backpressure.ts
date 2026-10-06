import { WritableIterable } from "@j50n/proc";

const queue = new WritableIterable<number>();

for (let n = 1; n <= 3; n++) {
  await queue.write(n); // resolves at once; nothing has read it
  console.log(`wrote ${n}`);
}
await queue.close();

for await (const n of queue) console.log(`read ${n}`);
