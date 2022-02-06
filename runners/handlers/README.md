# Handlers

## Non-Streaming Handlers

### Bytes (`Uint8Array`)

Bytes can be used as input or output.

In this example, we pass some bytes to `gzip` to compress them and then pass
those bytes to `gunzip` to decompress.

```ts
const pg = proc.group();
try {
  const pr = proc.runner(proc.bytesInput(), proc.bytesOutput())(pg);

  const original = new Uint8Array([1, 2, 3, 4, 5]);

  const gzipped = await pr.run({ cmd: ["gzip"] }, original);
  console.dir(gzipped);
  const unzipped = await pr.run({ cmd: ["gunzip"] }, gzipped);

  assertEquals(unzipped, original);
} finally {
  pg.close();
}
```

### Text (`string`)

Text can be used as input or output.

This example shows how you can wrap/hide a call to a process in a function. Since we
are not dealing with `AsyncIterable` data, we can create and close the `Group`
immediately.

It is a well known fact that people instinctively find things said by cows to be
more credible than things not said by cows, so you may want to use this in your
own code.

```ts
const cowsay = async (text: string): Promise<string> => {
  const pg = proc.group();
  try {
    return await proc.runner(proc.stringInput(), proc.stringOutput())(pg)
      .run({ cmd: ["cowsay"] }, text);
  } finally {
    pg.close();
  }
};

const whatTheCowSaid = await cowsay("*proc* is pretty cool!");

console.log(whatTheCowSaid);

/*
 *  ________________________
 * < *proc* is pretty cool! >
 *  ------------------------
 *        \   ^__^
 *         \  (oo)\_______
 *            (__)\       )\/\
 *                ||----w |
 *                ||     ||
 */
```

### Text (`string[]`)

## Streaming Handlers

### Bytes (`Reader`) - Input Only

### Bytes (`AsyncIterable<Uint8Array>`)

### Text (`AsyncIterable<string>`)

## Unbuffered Handlers

### Text (`AsyncIterable<string>`)