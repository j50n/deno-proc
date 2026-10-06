import { enumerate, range } from "@j50n/proc";

const words = ["one", "two", "three", "four", "five"];

console.log(await enumerate(words).drop(1).take(2).collect());
console.log(await range({ from: 1, to: 4 }).zip(enumerate(words)).collect());
console.log(
  await enumerate(["a b", "c"]).flatMap((s) => s.split(" ")).collect(),
);
console.log(
  await enumerate(["x", "y"]).concat(enumerate(["z"])).collect(),
);
