import { enumerate } from "@j50n/proc";

// enumerate() wraps an iterable. The items stay as they are.
console.log(await enumerate(["apple", "pear"]).collect());

// .enum() numbers the items. Each becomes [item, index].
console.log(await enumerate(["apple", "pear"]).enum().collect());
