import { run } from "@j50n/proc";

// The consumer stops: take(2) closes the pipeline behind it.
const sevens = await run("seq", "1", "1000000")
  .run("grep", "7")
  .lines
  .take(2)
  .collect();
console.log(sevens);

// A command stops: head exits after two lines, and `yes` stops with it.
const ys = await run("yes").run("head", "-n", "2").lines.collect();
console.log(ys);
