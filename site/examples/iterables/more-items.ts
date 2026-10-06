import { enumerate } from "@j50n/proc";

// More items: each line becomes its words.
async function* words(lines: AsyncIterable<string>) {
  for await (const line of lines) {
    yield* line.split(/\s+/).filter((word) => word.length > 0);
  }
}

console.log(
  await enumerate(["the quick", "  brown fox "]).transform(words).collect(),
);
