import { range } from "@j50n/proc";

console.log(await range({ to: 3 }).collect()); // stops before `to`
console.log(await range({ from: 1, until: 3 }).collect()); // may end on `until`
console.log(await range({ from: 10, to: 0, step: -3 }).collect());
console.log(await range({ from: 1, to: Infinity }).take(3).collect());
