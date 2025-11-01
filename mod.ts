/**
 * Run child processes and work with async iterables in Deno—with the fluent Array API you already know.
 *
 * ## Core Concepts
 *
 * **Process Management**: Use `run()` to execute commands. It returns a `ProcessEnumerable` that lets you
 * chain operations and access output as async iterables.
 *
 * **Async Iterables**: Use `enumerate()` to wrap any iterable (arrays, async iterables, etc.) and get
 * Array-like methods (`map`, `filter`, `reduce`, etc.). Call `.enum()` on the result to add indices.
 *
 * **Error Handling**: Errors propagate through pipelines naturally. Processes that exit with non-zero
 * codes throw `ExitCodeError` when you consume their output. Catch errors once at the end.
 *
 * **Resource Management**: Always consume process output via `.lines.collect()`, `.lines.forEach()`, or
 * similar. Unconsumed output causes resource leaks.
 *
 * ## Key Distinctions
 *
 * **Properties vs Methods**:
 * - Properties (no parentheses): `.lines`, `.status`, `.first`, `.last`
 * - Methods (with parentheses): `.collect()`, `.map()`, `.filter()`, `.count()`
 *
 * **enumerate() vs .enum()**:
 * - `enumerate(iterable)` wraps an iterable to add Array-like methods
 * - `.enum()` is a method that adds `[item, index]` tuples to the stream
 *
 * ## Type Hierarchy
 *
 * - `Enumerable<T>`: Base class providing Array-like methods for async iterables
 * - `ProcessEnumerable<T>`: Extends Enumerable, adds process-specific features (`.run()`, `.status`, `.pid`)
 * - `Process`: Low-level process handle (usually you use ProcessEnumerable instead)
 *
 * @example Basic process execution
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * // Run a command and collect output lines
 * const lines = await run("ls", "-la").lines.collect();
 * console.log(lines);
 * ```
 *
 * @example Chain processes like shell pipes
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * // Equivalent to: cat data.txt | grep error | wc -l
 * const result = await run("cat", "data.txt")
 *   .run("grep", "error")
 *   .run("wc", "-l")
 *   .lines.first;
 * ```
 *
 * @example Transform async iterables with Array methods
 * ```ts
 * import { enumerate } from "@j50n/proc";
 *
 * const data = ["apple", "banana", "cherry"];
 * const numbered = await enumerate(data)
 *   .enum()  // Adds [item, index] tuples
 *   .map(([fruit, i]) => `${i + 1}. ${fruit}`)
 *   .collect();
 * // ["1. apple", "2. banana", "3. cherry"]
 * ```
 *
 * @example Error handling
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * try {
 *   await run("npm", "test")
 *     .lines
 *     .filter(line => line.includes("FAIL"))
 *     .forEach(line => console.log(line));
 * } catch (error) {
 *   // All errors (process failures, transform errors) caught here
 *   console.error(`Failed: ${error.message}`);
 * }
 * ```
 *
 * @example Stream large files efficiently
 * ```ts
 * import { read } from "@j50n/proc";
 *
 * // Read, decompress, and process - all streaming, no temp files
 * const errorCount = await read("app.log.gz")
 *   .transform(new DecompressionStream("gzip"))
 *   .lines
 *   .filter(line => line.includes("ERROR"))
 *   .count();
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
