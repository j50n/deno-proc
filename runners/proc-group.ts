// import { IAsyncIter } from "https://deno.land/x/asynciter@0.0.15/asynciter.ts";
import { IAsyncIter } from "https://deno.land/x/asynciter@0.0.15/asynciter.ts";
import { PromiseOrIterable } from "../runner.ts";
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
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ) => PromiseOrIterable<B>;
}

/**
 * Command options.
 */
export interface RunOptions {
  /** The command to be run. */
  cmd: string[] | [URL, ...string[]];
  /** The current working directory. */
  cwd?: string;
  /** The process environment. */
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

export type Xyzzy<B> = B extends IAsyncIter<infer D> ? IAsyncIter<D>
  : Promise<B>;

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
  run<
    A,
    B,
  >(
    inputHandler: InputHandler<A>,
    outputHandler: OutputHandler<B>,
    input: A,
    options: RunOptions,
  ): B extends IAsyncIter<infer D> ? IAsyncIter<D>
    : Promise<B>;
  // run<A, B>(
  //   inputHandler: InputHandler<A>,
  //   outputHandler: OutputHandler<B>,
  //   input: A,
  //   options: RunOptions,
  // ): B | Promise<B>;
}
