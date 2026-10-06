import { run } from "@j50n/proc";

// The same program without main.
await run("./processes-service.sh").lines.forEach(console.log);
