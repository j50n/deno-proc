import { enumerate, shuffle } from "@j50n/proc";

// Run the tests in a random order. shuffle() changes the array in place.
const tests = ["parse", "render", "save", "load"];
shuffle(tests);

await enumerate(tests).forEach((test) => console.log(test)); // order varies
