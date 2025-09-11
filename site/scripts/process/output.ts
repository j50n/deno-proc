import { run } from "../../../mod.ts";

await run("echo", "Hello, world.").forEach((it) => console.dir(it));

await run("echo", "Hello,\nworld.").lines.forEach((it) => console.dir(it));

const data: string[] = await run("echo", "Hello,\nworld.").lines.collect();
console.dir(data);

await run("echo", "Hello, world.").toStdout();
