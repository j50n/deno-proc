import { enumerate, read, type TransformerFunction } from "@j50n/proc";

// Fewer items, with state: drop a line that repeats the one before it.
async function* dedupe(lines: AsyncIterable<string>) {
  let previous: string | undefined;
  for await (const line of lines) {
    if (line !== previous) yield line;
    previous = line;
  }
}

// Batching: a function that makes the step, so the size can vary.
function batches<T>(size: number): TransformerFunction<T, T[]> {
  return async function* (items) {
    let batch: T[] = [];
    for await (const item of items) {
      batch.push(item);
      if (batch.length === size) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) yield batch; // the last, short batch
  };
}

console.log(
  await enumerate(["a", "a", "b", "a", "a"]).transform(dedupe).collect(),
);
console.log(await read("fruit.txt").lines.transform(batches(2)).collect());
