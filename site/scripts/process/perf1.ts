/*
 * This is enough of a benchmark for me to be sure that I am not adding a significant
 * amount of overhead to the promise-based code with the `Enumerator` wrapper, and that
 * higher order functions are (in general) as performant as possible.
 */

import { enumerate, range } from "../../../mod.ts";

async function* count() {
  for (let i = 0; i < 1_000_000; i++) {
    yield i;
  }
}

async function* countArray() {
  for (let i = 0; i < 1_000; i++) {
    const arr: number[] = [];
    for (let j = 0; j < 1_000; j++) {
      arr[j] = i * 1_000 + j;
    }
    yield arr
  }
}

const numbers: number[] = [];

for (let i = 0; i < 1_000_000; i++) {
  numbers.push(i);
}

Deno.bench("naive async add with range and filter/map/reduce", async () => {
  await range({ to: 1_000_000 })
    .filter((i) => i % 2 === 0)
    .map((i) => i * 2)
    .reduce((acc, item) => acc + item);
});

Deno.bench("async grouped add with filter/map/reduce", async () => {
    /*
     * By combining into arrays and doing the calculations on the groups of values,
     * and only reducing at the end, the speedup is about 50x.
     */
  await enumerate(countArray())
    .map((items) => {
      return items
        .filter((it) => it % 2 === 0)
        .map((it) => it * 2)
        .reduce((acc, item) => acc + item);
    })
    .reduce((acc, item) => acc + item);
});

Deno.bench("async grouped add with filter/map/reduce as for loop", async () => {
    /*
     * This is only a little bit faster. Memory allocation overhead. You have the
     * same problem with fast-add if you don't cheat and pre-allocate the array.
     * Still, about 30% faster than the version using higher order functions.
     */
  await enumerate(countArray())
    .map((items) => {
        let acc = 0
        for(const item of items){
            if(item % 2 === 0){
                acc += item * 2
            }
        }
        return acc
    })
    .reduce((acc, item) => acc + item);
});

Deno.bench("naive async add with range and map/reduce", async () => {
  await range({ to: 1_000_000 })
    .map((i) => i * 2)
    .reduce((acc, item) => acc + item);
});

Deno.bench("naive async add with range and reduce", async () => {
  await range({ to: 1_000_000 })
    .reduce((acc, item) => acc + item);
});

Deno.bench("async add with enumerable and reduce", async () => {
  await enumerate(count()).reduce((acc, item) => acc + item);
});

Deno.bench("async simple add", async () => {
  let acc = 0;

  for await (const i of count()) {
    acc += i;
  }
});

Deno.bench("async add with range", async () => {
  /*
   * Should be similar time of "async add simple"
   */
  let acc = 0;
  for await (const i of range({ to: 1_000_000 })) {
    acc += i;
  }
});

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
