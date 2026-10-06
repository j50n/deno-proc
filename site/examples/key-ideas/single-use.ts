import { enumerate } from "@j50n/proc";

const doubled = enumerate([1, 2, 3]).map((n) => n * 2);

console.log(await doubled.collect());
console.log(await doubled.collect()); // already used up: nothing left

const saved = await enumerate([1, 2, 3]).map((n) => n * 2).collect();
console.log(await enumerate(saved).count(), await enumerate(saved).count());
