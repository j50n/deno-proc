import { sleep } from "../../mod.ts";

let count = 0;

for (;;) {
  console.log(`${new Date().toISOString()} ${count++}\nx\ny\nz`);
  await sleep(1000 + Math.random() * 10000);
}

// for (let j = 0; j < 10000000; j++) {
//   const acc: string[] = [];
//   for (let i = 0; i < 1000; i++) {
//     acc.push(
//       `${j}:${i} dsjkslfsjldjflskjflsdjfljslkdfjsdlkfjskjklsdjflksjdklsjldjfskdfsfdlsjfksl`,
//     );
//   }
//   console.log(acc.join(""));
//   await sleep(10000);
// }
