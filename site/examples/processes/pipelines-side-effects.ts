import { read, run } from "@j50n/proc";

// Into a file: writeTo is the consumer.
await read("app.log").run("grep", "WARN").writeTo("warnings.log");
console.log((await Deno.readTextFile("warnings.log")).trimEnd());

// A command run only for what it does: consume its (empty) output, so a
// failure throws.
await run("cp", "warnings.log", "warnings.bak").forEach(() => {});
console.log((await Deno.stat("warnings.bak")).isFile);
