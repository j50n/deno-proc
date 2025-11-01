/**
 * Run child processes and work with async iterables in Deno—with the fluent Array API you already know.
 *
 * @example Basic usage
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * const lines = await run("ls", "-la").lines.collect();
 * console.log(lines);
 * ```
 *
 * @example Chain processes
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * const result = await run("cat", "data.txt")
 *   .run("grep", "error")
 *   .run("wc", "-l")
 *   .lines.first;
 * ```
 *
 * @example Work with async iterables
 * ```ts
 * import { enumerate } from "@j50n/proc";
 *
 * const data = ["apple", "banana", "cherry"];
 * const numbered = await enumerate(data)
 *   .enum()
 *   .map(([fruit, i]) => `${i + 1}. ${fruit}`)
 *   .collect();
 * ```
 *
 * @module
 */

export * from "./src/utility.ts";
export * from "./src/process.ts";
export * from "./src/run.ts";
export * from "./src/enumerable.ts";
export * from "./src/transformers.ts";
export * from "./src/writable-iterable.ts";
export * from "./src/cache.ts";
