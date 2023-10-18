import { run } from "https://deno.land/x/proc@0.21.3/mod.ts";

await run("echo", "Hello, world.").forEach((it) => console.dir(it));

await run("echo", "Hello,\nworld.").lines.forEach((it) => console.dir(it));

const data: string[] = await run("echo", "Hello,\nworld.").lines.collect();
console.dir(data);

await run("echo", "Hello, world.").toStdout();
