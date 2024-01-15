import { sleep } from "../mod.ts";

await Promise.all([
  (async () => {
    const writer = Deno.stdout.writable.getWriter();
    console.error("got 1");
    try {
      for (let i = 0; i < 10; i += 2) {
        await writer.write(new TextEncoder().encode(`${i}\n`));
        await sleep(1000);
      }
    } finally {
      writer.releaseLock();
    }
  })(),
  (async () => {
    const writer = Deno.stdout.writable.getWriter();
    console.error("got 2");
    try {
      for (let i = 1; i < 10; i += 2) {
        await writer.write(new TextEncoder().encode(`${i}\n`));
        await sleep(1000);
      }
    } finally {
      writer.releaseLock();
    }
  })(),
]);
