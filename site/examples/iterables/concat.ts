import { concat, concatLines, read } from "@j50n/proc";

// The whole file as one Uint8Array.
const bytes = concat(await read("fruit.txt").collect());
console.log(bytes.length);

// Lines of bytes back into text, with "\n" after each.
const encoder = new TextEncoder();
const text = concatLines([encoder.encode("one"), encoder.encode("two")]);
console.log(JSON.stringify(new TextDecoder().decode(text)));
