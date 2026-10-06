import { isString } from "@j50n/proc";

const values: unknown[] = ["text", 42, new String("boxed")];
console.log(values.map(isString));
