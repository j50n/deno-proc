import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "./closers.ts";
import { GroupImpl } from "./proc-group-impl.ts";

/**
 * The interface of an input handler.
 */
export interface InputHandler<A> {
  /**
   * A hack to detect when empty input is actually an error at runtime, since
   * I can't get Typescript to figure it out at compile time.
   */
  get failOnEmptyInput(): boolean;

  /**
   * Called by the runner to process the input data.
   */
  processInput: (input: A, stdin: MultiCloseWriter) => Promise<void>;
}

/**
 * The interface of an output handler.
 */
export interface OutputHandler<B> {
  /**
   * Handle the output (stdout, stderr, and exit status) of a process.
   *
   * `stdin` is included so that it can be closed. It must not be read from the output handler.
   *
   * @param stdout Process standard out.
   * @param stderr Process standard error.
   * @param process The process.
   * @param input `stdin` (to be closed) and the result of the input handler (to be awaited).
   * @throws ProcessExitError A process returned an exit code that indicated that an error occurred.
   */
  processOutput: (
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<void> },
  ) => B | Promise<B>;
}

/**
 * Command options.
 *
 * @param cmd The command to be run.
 * @param cwd The current working directory.
 * @param env The process environment.
 */
export interface RunOptions {
  cmd: string[] | [URL, ...string[]];
  cwd?: string;
  env?: {
    [key: string]: string;
  };
}

/**
 * Create a new `Group` for running processes.
 *
 * Note that a `Group` cannot be garbage-collected
 * until it is explicitly closed. If you don't close
 * a group, its processes will be cleaned up when the
 * Deno process exits. However, if you create a large
 * number of groups without closing them, be aware
 * that this will leak memory and potentially leak
 * resources as well.
 *
 * @returns A new `Group` instance.
 */
export function group(): Group {
  return new GroupImpl();
}

/**
 * A process group.
 *
 * A process group must be closed to allow it to be garbage collected.
 */
export interface Group extends Deno.Closer {
  /**
   * Flat process API.
   * @param inputHandler The input handler.
   * @param outputHandler The output handler.
   * @param input The input. `undefined` for empty input.
   * @param options The run options.
   */
  run<A, B>(
    inputHandler: InputHandler<A>,
    outputHandler: OutputHandler<B>,
    input: A,
    options: RunOptions,
  ): B | Promise<B>;
}
