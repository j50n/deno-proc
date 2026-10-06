import { enumerate, gunzip, gzip, read } from "@j50n/proc";

// Bytes go straight into the web streams.
const errors = await read("app.log.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .count((line) => line.includes("ERROR"));
console.log(`${errors} errors`);

await read("app.log")
  .transform(new CompressionStream("gzip"))
  .writeTo("copy.log.gz");

// gzip and gunzip also take lines of text.
await enumerate(["alpha", "beta"]).transform(gzip).writeTo("words.gz");
console.log(await read("words.gz").transform(gunzip).lines.collect());
