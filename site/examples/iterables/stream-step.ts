import { enumerate } from "@j50n/proc";

// A TransformStream works too.
function upper() {
  return new TransformStream<string, string>({
    transform(line, controller) {
      controller.enqueue(line.toUpperCase());
    },
  });
}

console.log(await enumerate(["one", "two"]).transform(upper()).collect());

// A stream is used up after one pass: the second use yields nothing.
const once = upper();
console.log(await enumerate(["three"]).transform(once).collect());
console.log(await enumerate(["four"]).transform(once).collect());
