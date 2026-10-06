import { run } from "@j50n/proc";

// `seq` writes about 600 KB, far more than the pipe holds. Reading the output
// and throwing it away lets it finish, and a failure would still throw.
await run("seq", "1", "100000").forEach(() => {});

console.log("done");
