// Runs stdin-errors.ts the way the page shows, `deno run stdin-errors.ts <
// app.log`, so the page's output is checked. It isn't shown on the page.
import { read } from "@j50n/proc";

const script = new URL("./stdin-errors.ts", import.meta.url).pathname;
await read("app.log").run(Deno.execPath(), "run", "--quiet", script).toStdout();
