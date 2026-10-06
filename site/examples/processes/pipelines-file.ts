import { read } from "@j50n/proc";

// grep -c ERROR < app.log
const count = await read("app.log").run("grep", "-c", "ERROR").lines.first;

console.log(count);
