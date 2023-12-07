import { sleep } from "../mod.ts";

globalThis.addEventListener("unload", () => {
  console.log("HIT UNLOAD");
});

for (;;) {
  await sleep(5000);
  Deno.exit(1);
}
