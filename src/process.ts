import type { Closer } from "@std/io/types";
import { type Enumerable, enumerate } from "./enumerable.ts";
import { buffer, toBytes } from "./transformers.ts";
import { type Writable, WritableIterable } from "./writable-iterable.ts";
import { track } from "./shutdown.ts";
import { handled } from "./helpers.ts";

/** How a child's stdin, stdout, or stderr is connected, as in `Deno.Command`. */
export type PipeKinds = "piped" | "inherit" | "null";

/**
 * Decide what a process's failure throws: rethrow it, throw your own error, or
 * return normally to throw nothing. Set it as `fnError` in
 * {@link ProcessOptions}.
 *
 * It is called once, after stdout has ended, the child has exited, and
 * `fnStderr` has finished, and only when there is something to report: an
 * `error`, or `stderrData` that is not `null` or `undefined`. It is not called
 * when the consumer stops reading early.
 *
 * - `error` is the {@link ExitCodeError}, {@link SignalError}, or
 *   {@link UpstreamError} the process would throw, or the error `fnStderr`
 *   threw; `undefined` if the process succeeded.
 * - `stderrData` is what `fnStderr` resolved to; `undefined` if there is no
 *   `fnStderr` or it threw.
 *
 * Whatever it throws is what the consumer's `await` throws; set `cause` when
 * you wrap `error`. If it returns normally, iteration ends with no error. Every
 * line of output has been delivered either way. It may be `async`; the
 * consumer waits for it.
 */
export type ErrorHandler<S> = (
  error?: Error,
  stderrData?: S,
) => void | Promise<void>;

/**
 * Read a process's stderr, and return a value to hand to `fnError`. Set it as
 * `fnStderr` in {@link ProcessOptions}.
 *
 * It is called when the child starts, with stderr as raw bytes; use `.lines`
 * for text. With {@link run} and `.run()`, setting it pipes stderr here
 * instead of to your terminal; `new Process` needs `stderr: "piped"`, or the
 * constructor throws `TypeError`.
 *
 * Read stderr to the end. A child that writes more to stderr than its pipe
 * holds (about 64 KB) blocks until it is read, and if this function returns
 * without reading, the program hangs. Iteration of stdout doesn't finish until
 * the returned promise settles, and {@link main} and {@link terminateAll} wait
 * for it too, so it can write what it gathered after the child exits.
 *
 * Don't throw from it to fail the process. A throw replaces the process's own
 * error, so the exit code is lost. Return what you need and throw from
 * `fnError`.
 */
export type StderrHandler<S> = (it: Enumerable<Uint8Array>) => Promise<S>;

/**
 * Options for {@link run} and `.run()`, passed before the command:
 * `run({ cwd: "/tmp" }, "ls")`.
 *
 * `S` is the type `fnStderr` resolves to and `fnError` receives.
 *
 * @example Put the child's stderr into the error it throws
 * ```typescript
 * import { ExitCodeError, run } from "@j50n/proc";
 *
 * const lines = await run(
 *   {
 *     fnStderr: (stderr) => stderr.lines.collect(),
 *     fnError: (error, stderrLines) => {
 *       if (error instanceof ExitCodeError) {
 *         const detail = stderrLines?.join("\n") ?? "";
 *         throw new Error(`exit ${error.code}: ${detail}`, { cause: error });
 *       }
 *       if (error) throw error;
 *     },
 *   },
 *   "git",
 *   "status",
 * ).lines.collect();
 * ```
 */
export interface ProcessOptions<S> {
  /**
   * Working directory for the child. Default: this process's. A relative
   * program path such as `"./build.sh"` is found from here, not from this
   * process's directory.
   */
  readonly cwd?: string;
  /**
   * Environment variables to add to or override in the inherited environment.
   * A `PATH` here changes where the program is looked up, so don't build `env`
   * from untrusted input.
   */
  readonly env?: Record<string, string>;
  /**
   * Start the child with no environment but `env`, rather than this
   * process's environment plus `env`. Use it to keep secrets in your
   * environment from reaching the child. Without a `PATH` in `env`, a bare
   * program name may no longer be found; give a path. Default `false`.
   */
  readonly clearEnv?: boolean;
  /**
   * Stop the child after this many milliseconds: proc sends it SIGTERM, and
   * reading its output throws {@link TimeoutError} once it has exited,
   * however it exited. The timer starts when the child does and stops when
   * it exits, so it bounds a child you stopped reading early, too. A child
   * that ignores SIGTERM keeps running; proc never sends SIGKILL. On
   * Windows, Deno's SIGTERM can't be caught: the child is ended at once.
   * Default: no limit.
   */
  readonly timeoutMs?: number;

  /** Read the child's stderr. See {@link StderrHandler}. */
  fnStderr?: StderrHandler<S>;
  /** Change or suppress the error the process throws. See {@link ErrorHandler}. */
  fnError?: ErrorHandler<S>;

  /**
   * Collect what proc writes to the child's stdin into chunks of at least
   * 16 KB before each write. Default `false`.
   *
   * It speeds up feeding many small items, as with `.run()` after a
   * `.map()`. The child sees no input until 16 KB has collected or the input
   * ends, so leave it off for a child that must answer each line as it comes.
   * It has no effect on {@link run}, whose child has no stdin.
   */
  buffer?: boolean;
}

/**
 * Options for `new` {@link Process}: {@link ProcessOptions} plus how each
 * stream is connected. A stream you leave out is inherited from this process,
 * as with `Deno.Command`.
 */
export interface ProcessStreamOptions<S> extends ProcessOptions<S> {
  /** How stdin is connected. `"piped"` to write it with `stdin` or `writeToStdin`. */
  stdin?: PipeKinds;
  /** How stdout is connected. `"piped"` to read it, and to get exit errors. */
  stdout?: PipeKinds;
  /** How stderr is connected. `"piped"` to read it with `stderr` or `fnStderr`. */
  stderr?: PipeKinds;
}

/**
 * The base class of the errors a process throws when it fails:
 * {@link ExitCodeError}, {@link SignalError}, {@link TimeoutError}, and
 * {@link UpstreamError}.
 * Catch it to handle any of them.
 *
 * `name` is the subclass's name. `cause` is the earlier error that led to this
 * one, if any; `options.cause` holds the same value.
 *
 * Printing one, or `JSON.stringify`, shows the message, the program and the
 * cause, but not `command`'s arguments, which can hold secrets: read
 * `command` to get them.
 */
export abstract class ProcessError extends Error {
  /**
   * proc throws these itself; build one only to test code that handles it.
   *
   * @param message The error message.
   * @param options.cause The error that led to this one.
   */
  constructor(
    message: string,
    public readonly options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    hide(this, "options");
  }
}

/** Keep `key` out of what printing and `JSON.stringify` show. */
function hide(error: Error, key: string) {
  Object.defineProperty(error, key, { enumerable: false });
}

/**
 * Thrown by a process that exited cleanly when its input failed: the process
 * piped into it failed, a callback before the `.run()` threw, or its stdin was
 * closed with an error.
 *
 * `cause` is that failure, such as the upstream process's
 * {@link ExitCodeError}, and `message` is copied from it. `command` is the
 * process that threw, not the one that failed. If this process failed too, it
 * throws its own `ExitCodeError` or `SignalError` instead, with the same
 * `cause`.
 *
 * @example
 * ```typescript
 * import { ExitCodeError, run, UpstreamError } from "@j50n/proc";
 *
 * try {
 *   await run("sh", "-c", "exit 1").run("cat").lines.collect();
 * } catch (error) {
 *   if (error instanceof UpstreamError && error.cause instanceof ExitCodeError) {
 *     console.error(`${error.cause.command[0]} exited with ${error.cause.code}`);
 *   }
 * }
 * ```
 */
export class UpstreamError extends ProcessError {
  /**
   * proc throws these itself; build one only to test code that handles it.
   *
   * @param message The error message.
   * @param command The command and arguments of the process that threw.
   * @param options.cause The upstream failure.
   */
  constructor(
    message: string,
    public readonly command: string[],
    options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    hide(this, "command");
  }
}

/**
 * Thrown when a process exits with a non-zero code. It is thrown where you
 * read the output, after the last line has been delivered.
 *
 * `code` is the exit code and `command` the command and arguments. `cause` is
 * set when the process's input failed too, as described for
 * {@link UpstreamError}. `fnError` can replace or suppress it.
 *
 * @example
 * ```typescript
 * import { ExitCodeError, run } from "@j50n/proc";
 *
 * try {
 *   await run("sh", "-c", "echo partial; exit 3").lines.forEach(console.log);
 * } catch (error) {
 *   if (error instanceof ExitCodeError) {
 *     console.error(`${error.command[0]} exited with ${error.code}`);
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 */
export class ExitCodeError extends ProcessError {
  /**
   * proc throws these itself; build one only to test code that handles it.
   *
   * @param message The error message.
   * @param command The command and arguments.
   * @param code The exit code.
   * @param options.cause The failure of this process's input, if any.
   */
  constructor(
    message: string,
    public readonly command: string[],
    public readonly code: number,
    options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    hide(this, "command");
  }
}

/**
 * Thrown when a process is killed by a signal, such as `"SIGKILL"`. It is
 * thrown where you read the output, after the last line has been delivered.
 *
 * `signal` is the signal and `command` the command and arguments. `cause` is
 * set when the process's input failed too, as described for
 * {@link UpstreamError}. `fnError` can replace or suppress it.
 *
 * Stopping early doesn't throw it, though the child usually dies of SIGPIPE
 * when you do.
 */
export class SignalError extends ProcessError {
  /**
   * proc throws these itself; build one only to test code that handles it.
   *
   * @param message The error message.
   * @param command The command and arguments.
   * @param signal The signal that killed the process.
   * @param options.cause The failure of this process's input, if any.
   */
  constructor(
    message: string,
    public readonly command: string[],
    public readonly signal: Deno.Signal,
    options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    hide(this, "command");
  }
}

/**
 * Thrown when a process ran past its `timeoutMs` and proc stopped it. It is
 * thrown where you read the output, after the last line has been delivered,
 * whatever the exit code or signal: a run that was cut short didn't succeed.
 *
 * `timeoutMs` is the limit and `command` the command and arguments. `cause`
 * is set when the process's input failed too, as described for
 * {@link UpstreamError}. `fnError` can replace or suppress it.
 *
 * @example
 * ```typescript
 * import { run, TimeoutError } from "@j50n/proc";
 *
 * try {
 *   await run({ timeoutMs: 100 }, "sleep", "5").lines.collect();
 * } catch (error) {
 *   if (error instanceof TimeoutError) console.error(error.message);
 *   // sleep timed out after 100 ms
 * }
 * ```
 */
export class TimeoutError extends ProcessError {
  /**
   * proc throws these itself; build one only to test code that handles it.
   *
   * @param message The error message.
   * @param command The command and arguments.
   * @param timeoutMs The limit the process ran past.
   * @param options.cause The failure of this process's input, if any.
   */
  constructor(
    message: string,
    public readonly command: string[],
    public readonly timeoutMs: number,
    options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    hide(this, "command");
  }
}

/**
 * A child process whose stdout is an async iterable that throws when the
 * process fails. {@link run} and `.run()` are built on it.
 *
 * Use it when you need a connection `run()` doesn't give you: writing the
 * child's stdin yourself as you go ({@link Process.stdin}), or choosing
 * `"inherit"`, `"piped"`, or `"null"` for each stream. Otherwise use `run()`.
 *
 * The child starts in the constructor, which throws `Deno.errors.NotFound` if
 * the command doesn't exist. Streams you don't name are inherited. Exit status
 * is checked only while iterating {@link Process.stdout}, which throws the same
 * errors as `run()` after the last chunk; with stdout not piped, nothing
 * throws, and you check {@link Process.status} yourself. The traps of `run()`
 * apply too: read stdout, and close stdin when you're done writing, or the
 * child waits for more input.
 *
 * @example Write to a child's stdin and read its output
 * ```typescript
 * import { enumerate, Process } from "@j50n/proc";
 *
 * const p = new Process({ stdin: "piped", stdout: "piped" }, "sort", []);
 * const sorted = enumerate(p.stdout).lines.collect();
 *
 * await p.stdin.write("pear");
 * await p.stdin.write("apple");
 * await p.stdin.close();
 *
 * console.log(await sorted); // ["apple", "pear"]
 * ```
 */
export class Process<S> implements Closer {
  /** A random UUID, unique to this instance. */
  readonly id: `${string}-${string}-${string}-${string}-${string}` = crypto
    .randomUUID();

  private stderrResult: Promise<S> | undefined;

  /**
   * The underlying child. This class reads its streams; reading them here as
   * well fails with a locked stream.
   */
  readonly process: Deno.ChildProcess;

  /**
   * Spawn the child.
   *
   * @param options How to connect each stream, plus {@link ProcessOptions}.
   * @param cmd The program: a name looked up on `PATH`, a path, or a file URL.
   * @param args The arguments.
   * @throws {Deno.errors.NotFound} If the program doesn't exist.
   * @throws {RangeError} If `timeoutMs` is not a number of at least 0.
   */
  constructor(
    public readonly options: ProcessStreamOptions<S>,
    public readonly cmd: string | URL,
    public readonly args: readonly string[],
  ) {
    if (options.fnStderr != null && options.stderr !== "piped") {
      throw new TypeError('fnStderr needs stderr: "piped"');
    }

    const timeoutMs = options.timeoutMs;
    if (timeoutMs !== undefined && !(timeoutMs >= 0)) {
      throw new RangeError(`timeoutMs must be at least 0; got ${timeoutMs}`);
    }

    // Only the options proc defines; anything else in `options` stays out.
    const { cwd, env, clearEnv, stdin, stdout, stderr } = options;
    this.process = new Deno.Command(this.cmd, {
      cwd,
      env,
      clearEnv,
      stdin,
      stdout,
      stderr,
      args: [...this.args],
    }).spawn();
    const fnStderr = options.fnStderr;
    if (fnStderr != null) {
      // Async, so one that throws at once fails the output like any other.
      const stderr = enumerate(this.process.stderr);
      this.stderrResult = handled((async () => await fnStderr(stderr))());
    }
    track(this.process, this.stderrResult);

    // setTimeout fires at once past its 32-bit range: no timer is the same.
    if (timeoutMs !== undefined && timeoutMs < 2 ** 31 - 1) {
      const timer = setTimeout(() => {
        this.timedOut = true;
        try {
          this.process.kill("SIGTERM");
        } catch {
          // It exited as the timer fired.
        }
      }, timeoutMs);
      const stop = () => clearTimeout(timer);
      this.process.status.then(stop, stop);
    }
  }

  /** Whether `timeoutMs` ran out and proc sent the child SIGTERM. */
  private timedOut = false;

  private _stderr: AsyncIterable<Uint8Array> | undefined;
  private _stdout: AsyncIterable<Uint8Array<ArrayBuffer>> | undefined;
  private _stdin:
    | WritableIterable<Uint8Array | Uint8Array[] | string | string[]>
    | undefined;

  private _isClosed = false;
  private _passError: Error | undefined;

  /** Whether {@link Process.close} has been called. */
  get isClosed(): boolean {
    return this._isClosed;
  }

  /**
   * Close the child's stdin if it was opened through {@link Process.stdin}.
   * It doesn't signal or kill the child. Calls after the first do nothing.
   * Iterating {@link Process.stdout} calls it when the output ends.
   */
  async close(): Promise<void> {
    if (!this.isClosed) {
      this._isClosed = true;

      if (this._stdin != null) {
        await this._stdin.close();
      }
    }
  }

  /** The child's process ID. */
  get pid(): number {
    return this.process.pid;
  }

  /**
   * Resolves when the child exits, with its exit code or signal. It doesn't
   * throw for a failed exit. A child that fills its stdout pipe doesn't exit
   * until something reads it, so wait on this alone only when output is
   * small or not piped.
   */
  get status(): Promise<Deno.CommandStatus> {
    return this.process.status;
  }

  /**
   * The child's stderr, as bytes.
   *
   * Read it to the end, or a child that writes more than the pipe holds
   * blocks. Don't use it together with `fnStderr`, which reads the same
   * stream.
   *
   * @throws {Deno.errors.NotConnected} Unless `stderr` is `"piped"`.
   */
  get stderr(): AsyncIterable<Uint8Array> {
    if (this.options.stderr !== "piped") {
      throw new Deno.errors.NotConnected("stderr only available when 'piped'");
    }

    if (this._stderr == null) {
      const process = this.process;

      this._stderr = {
        async *[Symbol.asyncIterator]() {
          yield* process.stderr;
        },
      };
    }
    return this._stderr;
  }

  /**
   * The child's stdout, as bytes. After the last chunk, it throws
   * {@link ExitCodeError}, {@link SignalError}, or {@link UpstreamError} if
   * the process failed, or what `fnError` decides. Stopping early throws
   * nothing.
   *
   * Iterate it once; a second pass yields nothing.
   *
   * @throws {Deno.errors.NotConnected} Unless `stdout` is `"piped"`.
   */
  get stdout(): AsyncIterable<Uint8Array<ArrayBuffer>> {
    if (this.options.stdout !== "piped") {
      throw new Deno.errors.NotConnected("stdout only available when 'piped'");
    }

    if (this._stdout == null) {
      const close = this.close.bind(this);
      const process = this.process;
      const cmd = [this.cmd, ...this.args].map((it) => it.toString());

      const passError = () => this._passError;
      const timedOut = () => this.timedOut;
      const timeoutMs = this.options.timeoutMs;

      const catchHandler = async (error?: Error) => {
        const errorHandler = this.options.fnError;

        if (errorHandler != null) {
          const stderrResult = async () => {
            if (this.stderrResult == null) {
              return undefined;
            } else {
              try {
                return await this.stderrResult;
              } catch {
                /*
                 * Looks a little weird, but the error is caught earlier
                 * and passed as the primary error. We just ignore here.
                 */
                return undefined;
              }
            }
          };

          const stderrData = await stderrResult();

          if (error != null || stderrData != null) {
            await errorHandler(error, stderrData);
          }
        } else {
          if (error != null) {
            throw error;
          }
        }
      };

      const ser = this.stderrResult;
      let started = false;
      this._stdout = {
        async *[Symbol.asyncIterator]() {
          // The output and the exit status can be read once.
          if (started) return;
          started = true;

          try {
            let error: Error | undefined;
            try {
              // A consumer that stops early returns from here: it has its
              // answer, so it doesn't wait for the child to exit, or for
              // fnStderr to read to the end, and hears no error from either.
              yield* process.stdout;

              const status = await process.status;
              await ser;

              const cause = passError();

              if (timedOut()) {
                throw new TimeoutError(
                  `${cmd[0]} timed out after ${timeoutMs} ms`,
                  cmd,
                  timeoutMs!,
                  cause == null ? undefined : { cause },
                );
              } else if (status.signal != null) {
                // The program only: arguments can hold secrets, and messages
                // end up in logs. `command` has the rest.
                throw new SignalError(
                  `${cmd[0]} was killed by ${status.signal}`,
                  cmd,
                  status.signal,
                  cause == null ? undefined : { cause },
                );
              } else if (status.code !== 0) {
                throw new ExitCodeError(
                  `${cmd[0]} exited with code ${status.code}`,
                  cmd,
                  status.code,
                  cause == null ? undefined : { cause },
                );
              } else if (cause) {
                throw new UpstreamError(cause.message, cmd, { cause });
              }
            } catch (e) {
              error = e as Error | undefined;
            }
            await catchHandler(error as Error | undefined);
          } finally {
            await close();
          }
        },
      };
    }
    return this._stdout;
  }

  /**
   * The child's stdin, for writing items one at a time as you produce them.
   *
   * A string is written as a line (a newline is added), a `string[]` as one
   * line per string, and bytes as they are. `write` doesn't wait for the
   * child to read: there is no backpressure, and items queue in memory until
   * the child takes them. Once the child has exited and its output has been
   * read, `write` rejects with `Error`. Call `close()` when you are done, or
   * the child waits for
   * more input; `close(error)` instead makes {@link Process.stdout} throw an
   * {@link UpstreamError} with `error` as its `cause`.
   *
   * Each write costs more than feeding the same items through
   * {@link Process.writeToStdin}, so prefer that when the data is already an
   * iterable. Use one or the other: the second to start throws `TypeError`.
   *
   * @throws {Deno.errors.NotConnected} Unless `stdin` is `"piped"`.
   */
  get stdin(): Writable<Uint8Array | Uint8Array[] | string | string[]> {
    if (this._stdin == null) {
      const pi = new WritableIterable<
        Uint8Array | Uint8Array[] | string | string[]
      >();
      this.writeToStdin(pi); //hanging promise by design
      this._stdin = pi;
    }
    return this._stdin;
  }

  /**
   * Write everything `iter` yields to the child's stdin, then close it. Items
   * convert as for {@link Process.stdin}; `buffer: true` collects them into
   * 16 KB writes.
   *
   * The promise resolves once the input is written and closed, and never
   * rejects. If `iter` throws, its error reaches the reader of
   * {@link Process.stdout} as the `cause` of the error thrown there. A child
   * that exits before reading all its input ends the writing quietly.
   *
   * Call it at most once, and not together with {@link Process.stdin}; the
   * second to start throws `TypeError`.
   *
   * @param iter The data to write.
   * @throws {Deno.errors.NotConnected} Unless `stdin` is `"piped"`.
   */
  writeToStdin(
    iter: AsyncIterable<Uint8Array | Uint8Array[] | string | string[]>,
  ): Promise<void> {
    if (this.options.stdin !== "piped") {
      throw new Deno.errors.NotConnected("stdin only available when 'piped'");
    }

    const bufferInput = this.options.buffer === true;

    const writer = this.process.stdin.getWriter();

    let writerIsClosed = false;
    const closeWriter = async () => {
      if (!writerIsClosed) {
        writerIsClosed = true;
        try {
          await writer.close();
        } catch (e) {
          if (!(e instanceof TypeError)) {
            if (this._passError == null) {
              this._passError = e as Error | undefined;
            }
          }
        }
      }
    };

    return (async () => {
      try {
        for await (const it of buffer(bufferInput ? 16384 : 0)(toBytes(iter))) {
          await writer.write(it);
        }
      } catch (e) {
        if (
          this._passError == null &&
          !(e instanceof Deno.errors.BrokenPipe)
        ) {
          this._passError = e as Error | undefined;
        }
      } finally {
        await closeWriter();
      }
    })();
  }
}
