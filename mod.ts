/**
 * Run child processes and work with async iterables in Deno—with the fluent Array API you already know.
 *
 * 📚 **[Full Documentation](https://j50n.github.io/deno-proc/)**
 *
 * @example Quick start
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * // Run processes and capture output
 * const lines = await run("ls", "-la").lines.collect();
 *
 * // Chain processes like a shell pipeline
 * const result = await run("cat", "data.txt")
 *   .run("grep", "error")
 *   .run("wc", "-l")
 *   .lines.first;
 *
 * // Work with async iterables using familiar Array methods
 * const commits = await run("git", "log", "--oneline")
 *   .lines
 *   .map(line => line.trim())
 *   .filter(line => line.includes("fix"))
 *   .take(5)
 *   .collect();
 * ```
 *
 * ## Why proc?
 *
 * **Errors that just work** — Errors propagate through pipelines naturally, just like data. No edge cases,
 * no separate error channels, no callbacks. One try-catch at the end handles everything.
 *
 * **Powerful process management** — Run commands, pipe between processes, capture output, and control
 * execution with a clean, composable API.
 *
 * **Async iterables that feel like Arrays** — Use `map`, `filter`, `reduce`, `flatMap`, `take`, `drop`,
 * and more on any async iterable. No more wrestling with streams.
 *
 * **Type-safe and ergonomic** — Full TypeScript support with intuitive APIs that guide you toward correct usage.
 *
 * ## Key Concepts
 *
 * **Properties vs Methods**: Some APIs are properties (`.lines`, `.status`, `.first`) and some are methods
 * (`.collect()`, `.map()`, `.filter()`). Properties don't use parentheses.
 *
 * **Resource Management**: Always consume process output via `.lines.collect()`, `.lines.forEach()`, or
 * similar. Unconsumed output causes resource leaks.
 *
 * **Error Handling**: Processes that exit with non-zero codes throw `ExitCodeError` when you consume their
 * output. Use try-catch to handle failures.
 *
 * **Enumeration**: `enumerate()` wraps iterables but doesn't add indices. Call `.enum()` on the result to
 * get `[item, index]` tuples.
 *
 * ## Type Hierarchy (for AI/advanced users)
 *
 * - `Enumerable<T>`: Base class providing Array-like methods for async iterables
 * - `ProcessEnumerable<T>`: Extends Enumerable, adds process-specific features (`.run()`, `.status`, `.pid`)
 * - `Process`: Low-level process handle (usually you use ProcessEnumerable instead)
 *
 * @example Stream and process large compressed files
 * ```ts
 * import { read } from "@j50n/proc";
 *
 * // Read, decompress, and count lines - all streaming, no temp files!
 * const lineCount = await read("war-and-peace.txt.gz")
 *   .transform(new DecompressionStream("gzip"))
 *   .lines
 *   .count();
 *
 * console.log(`${lineCount} lines`); // 23,166 lines
 * ```
 *
 * @example Handle errors gracefully
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * try {
 *   // Errors propagate through the entire pipeline
 *   await run("npm", "test")
 *     .lines
 *     .map(line => line.toUpperCase())
 *     .filter(line => line.includes("FAIL"))
 *     .forEach(line => console.log(line));
 * } catch (error) {
 *   // Handle all errors in one place
 *   if (error.code) {
 *     console.error(`Tests failed with code ${error.code}`);
 *   }
 * }
 * ```
 *
 * @example Transform async iterables
 * ```ts
 * import { enumerate } from "@j50n/proc";
 *
 * const data = ["apple", "banana", "cherry"];
 *
 * const numbered = await enumerate(data)
 *   .enum()  // Adds [item, index] tuples
 *   .map(([fruit, i]) => `${i + 1}. ${fruit}`)
 *   .collect();
 *
 * console.log(numbered); // ["1. apple", "2. banana", "3. cherry"]
 * ```
 *
 * @example Process large files efficiently
 * ```ts
 * import { read } from "@j50n/proc";
 *
 * const errorCount = await read("app.log")
 *   .lines
 *   .filter(line => line.includes("ERROR"))
 *   .reduce((count) => count + 1, 0);
 *
 * console.log(`Found ${errorCount} errors`);
 * ```
 *
 * @example Parallel processing with concurrency control
 * ```ts
 * import { enumerate } from "@j50n/proc";
 *
 * const urls = ["url1", "url2", "url3"];
 *
 * await enumerate(urls)
 *   .concurrentMap(async (url) => {
 *     const response = await fetch(url);
 *     return { url, status: response.status };
 *   }, { concurrency: 5 })
 *   .forEach(result => console.log(result));
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
