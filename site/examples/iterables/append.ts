import { enumerate, toBytes } from "@j50n/proc";

// writeTo(path) replaces the file. To add to it, open it yourself.
await enumerate(["first run"]).transform(toBytes).writeTo("notes.txt");

const file = await Deno.open("notes.txt", { append: true });
await enumerate(["second run"]).transform(toBytes).writeTo(file.writable);

console.log(JSON.stringify(await Deno.readTextFile("notes.txt")));
