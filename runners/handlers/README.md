# Handlers

## Non-Streaming Handlers

### Byte Arrays (`Uint8Array`)

Byte arrays (`Uint8Array`) may be used as input or returned as output from a
process.

```ts
const pg = proc.group();
try {
  const pr = proc.runner(proc.bytesInput(), proc.bytesOutput())(pg);

  const original = new Uint8Array([1, 2, 3, 4, 5]);
  const gzipped = await pr.run({ cmd: ["gzip", "-c"] }, original);
  console.dir(gzipped);
  const unzipped = await pr.run({ cmd: ["gzip", "-cd"] }, gzipped);

  assertEquals(unzipped, original);
} finally {
  pg.close();
}
```

## Streaming Handlers
