import { read } from "@j50n/proc";

// Read the file once, and go over the lines two ways side by side.
const [a, b] = read("app.log").lines.tee();

const [total, errors] = await Promise.all([
  a.count(),
  b.count((line) => line.includes("ERROR")),
]);

console.log(`${errors} of ${total} lines are errors`);
