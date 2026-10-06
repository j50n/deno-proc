import { read } from "@j50n/proc";

// zcat book.gz | tr -cs A-Za-z '\n' | tr A-Z a-z | sort | uniq -c | sort -rn | head
const top = await read("recipes-warandpeace.txt.gz")
  .transform(new DecompressionStream("gzip"))
  .run("tr", "-cs", "A-Za-z", "\n") // anything but a letter ends a word
  .run("tr", "A-Z", "a-z")
  .run("sort")
  .run("uniq", "-c")
  .run("sort", "-rn")
  .lines
  .take(10)
  .collect();

console.log(top.join("\n"));
