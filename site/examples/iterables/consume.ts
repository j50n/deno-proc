import { enumerate, range } from "@j50n/proc";

const numbers = () => range({ from: 1, until: 6 }); // 1 to 6, a new one each time

console.log(await numbers().count((n) => n % 2 === 0)); // 3
console.log(await numbers().find((n) => n > 4)); // 5
console.log(await numbers().find((n) => n > 10)); // undefined
console.log(await numbers().some((n) => n > 5)); // true
console.log(await numbers().every((n) => n > 5)); // false
console.log(await numbers().first); // 1, a getter

try {
  await enumerate<number>([]).first;
} catch (error) {
  if (error instanceof RangeError) console.log("empty: no first item");
}
