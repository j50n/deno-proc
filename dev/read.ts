import { enumerate } from "../mod.ts";

for await (const line of enumerate(Deno.stdin.readable).lines) {
  console.log(line);
}

const warandpeace = await Deno.open(
  await Deno.realPath("./warandpeace.txt.gz"),
);
for await (
  const line of enumerate(warandpeace.readable).transform(
    new DecompressionStream("gzip"),
  ).lines
) {
  console.log(line);
}
