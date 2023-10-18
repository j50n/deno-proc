import { range } from "https://deno.land/x/proc@0.21.1/mod.ts";

Deno.bench("async add with range and reduce", async () => {
  await range({ to: 1_000_000 })
    .reduce(0, (acc, item) => acc + item);
});

Deno.bench("async add with range", async () => {
  let acc = 0;
  for await (const i of range({ to: 1_000_000 })) {
    acc += i;
  }
});

const numbers: number[] = [];

for (let i = 0; i < 1_000_000; i++) {
  numbers.push(i);
}

Deno.bench("in-memory array add with reduce", () => {
  numbers.reduce((acc, item) => acc + item, 0);
});

Deno.bench("in-memory array add", () => {
  let acc = 0;

  for (let i = 0; i < numbers.length; i++) {
    acc += numbers[i];
  }
});

Deno.bench("fast add", () => {
  let acc = 0;

  for (let i = 0; i < 1_000_000; i++) {
    acc += i;
  }
});
