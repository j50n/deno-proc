import { concat, enumerate } from "@j50n/proc";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

// `cat` echoes its stdin, so this shows exactly what the command received.
async function received(
  items: Iterable<string | string[] | Uint8Array | Uint8Array[]>,
) {
  const bytes = concat(await enumerate(items).run("cat").collect());
  return JSON.stringify(decoder.decode(bytes));
}

console.log(await received(["one", "two"])); // each string is a line
console.log(await received([["one", "two"], ["three"]])); // so is each element
console.log(await received([encoder.encode("raw"), encoder.encode("bytes")]));
