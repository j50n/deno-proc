import { enumerate, toBytes } from "@j50n/proc";

try {
  await enumerate(["one", "two"]).writeTo("out.txt");
} catch (error) {
  console.log(String(error));
}

await enumerate(["one", "two"]).transform(toBytes).writeTo("out.txt");
console.log(JSON.stringify(await Deno.readTextFile("out.txt")));
