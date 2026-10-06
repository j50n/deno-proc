/**
 * Run child processes from Deno the way a shell pipes them, with errors that
 * reach one `catch`, and work with any async iterable using the Array methods
 * you already know.
 *
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * const fixes = await run("git", "log", "--oneline")
 *   .run("grep", "fix")
 *   .lines
 *   .count();
 * ```
 *
 * Everything is an async iterable underneath. Data is pulled through a
 * pipeline a piece at a time, so a pipeline over a large file or a long-running
 * command runs in constant memory, and an error anywhere in it (a command that
 * fails, a callback that throws) comes out of the `await` at the end.
 *
 * Install with `deno add jsr:@j50n/proc`. Running commands needs
 * `--allow-run`; reading and writing files needs `--allow-read` and
 * `--allow-write`.
 *
 * **[Documentation](https://j50n.github.io/deno-proc/)**
 *
 * ## What is in it
 *
 * - {@link run} starts a command and returns its output as an iterable of
 *   bytes; `.lines` makes them text lines, `.run()` pipes them into the next
 *   command.
 * - {@link enumerate} wraps any iterable or async iterable in an
 *   {@link Enumerable}: `map`, `filter`, `reduce`, `take`, `concurrentMap`,
 *   `collect`, `forEach`, and more.
 * - {@link read} reads a file as bytes; `writeTo` and `toStdout` write a
 *   pipeline out.
 * - {@link main} wraps a program so that, however it ends, the child processes
 *   it started get to shut down before Deno exits.
 * - {@link WritableIterable} turns push-style code (callbacks, events) into an
 *   async iterable.
 * - `@j50n/proc/transforms` converts between CSV, TSV, JSON lines, and a
 *   record format.
 *
 * ## Five things to know
 *
 * 1. **Read the output.** A command starts when you call `run()`. Its stdout is
 *    a pipe: a child that writes more than the pipe holds waits until you read
 *    it, and if you never do, your program hangs. Consume it with `.lines`,
 *    `collect()`, `forEach()`, `toStdout()`, or similar.
 * 2. **Errors arrive at the end of the output.** A command that exits non-zero
 *    throws {@link ExitCodeError} after you have read every line it wrote.
 *    Wrap the `await` that consumes the pipeline in one `try`/`catch`.
 * 3. **Some members are properties.** `.lines`, `.first`, `.status`, and
 *    `.pid` take no parentheses; most others are methods.
 * 4. **Parsers yield batches.** The transforms in `@j50n/proc/transforms`
 *    yield arrays of rows; add `.flatten()` to work a row at a time.
 * 5. **In a container, wrap the program in `main()`.** Left alone, Deno exits
 *    the moment it is told to stop and the children are killed with it,
 *    without time to clean up.
 *
 * @example Capture a command's output
 * ```ts
 * import { run } from "@j50n/proc";
 *
 * const branch = await run("git", "branch", "--show-current").lines.first;
 * const files = await run("ls", "-1").lines.collect();
 * ```
 *
 * @example Handle a failed command
 * ```ts
 * import { ExitCodeError, run } from "@j50n/proc";
 *
 * try {
 *   await run("deno", "test").lines.toStdout();
 * } catch (error) {
 *   if (error instanceof ExitCodeError) {
 *     console.error(`${error.command.join(" ")} exited with ${error.code}`);
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 *
 * @example Feed data into a command
 * ```ts
 * import { enumerate } from "@j50n/proc";
 *
 * const sorted = await enumerate(["cherry", "apple", "banana"])
 *   .run("sort")
 *   .lines
 *   .collect();
 * // ["apple", "banana", "cherry"]
 * ```
 *
 * @example Read a compressed file a line at a time
 * ```ts
 * import { read } from "@j50n/proc";
 *
 * const errors = await read("app.log.gz")
 *   .transform(new DecompressionStream("gzip"))
 *   .lines
 *   .filter((line) => line.includes("ERROR"))
 *   .count();
 * ```
 *
 * @example Do work concurrently
 * ```ts
 * import { enumerate } from "@j50n/proc";
 *
 * const urls = ["https://example.com/a", "https://example.com/b"];
 *
 * const statuses = await enumerate(urls)
 *   .concurrentMap(async (url) => (await fetch(url)).status, {
 *     concurrency: 4,
 *   })
 *   .collect();
 * ```
 *
 * @example Let children shut down when the program ends
 * ```ts
 * import { main, run } from "@j50n/proc";
 *
 * await main(async () => {
 *   await run("./long-job.sh").lines.toStdout();
 * });
 * ```
 *
 * @example Convert CSV to TSV
 * ```ts
 * import { read } from "@j50n/proc";
 * import { fromCsvToRows, toTsv } from "@j50n/proc/transforms";
 *
 * await read("sales.csv")
 *   .transform(fromCsvToRows())
 *   .flatten()
 *   .filter((row) => Number(row[3]) > 1000)
 *   .transform(toTsv())
 *   .writeTo("large-sales.tsv");
 * ```
 *
 * @module
 */

export * from "./src/utility.ts";
export * from "./src/process.ts";
export * from "./src/shutdown.ts";
export * from "./src/run.ts";
export * from "./src/enumerable.ts";
export * from "./src/transformers.ts";
export * from "./src/writable-iterable.ts";
export * from "./src/cache.ts";
