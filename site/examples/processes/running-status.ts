import { run } from "@j50n/proc";

// No output to read, so waiting on the status alone is safe. It doesn't
// throw for a failed exit; it reports it.
const { success, code } = await run("test", "-e", "missing.txt").status;
console.log(success, code);

// With output: read it first, then look at the status.
const p = run("sh", "-c", "echo hello");
console.log(p.pid > 0);
console.log(await p.lines.collect());
console.log((await p.status).success);
