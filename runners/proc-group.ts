import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "./closers.ts";
import { GroupImpl } from "./proc-group-impl.ts";

export interface InputHandler<A> {
  get failOnEmptyInput(): boolean;
  processInput: (input: A, stdin: MultiCloseWriter) => Promise<void>;
}

export interface OutputHandler<B> {
  /**
   * Handle the output (stdout, stderr, and exit status) of a process.
   * @throws ProcessExitError A process returned an exit code that indicated that an error occurred.
   */
  processOutput: (
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<void> },
  ) => B | Promise<B>;
}

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

export interface Group extends Deno.Closer {
  run<A, B>(
    inputHandler: InputHandler<A>,
    outputHandler: OutputHandler<B>,
    input: A,
    options: RunOptions,
  ): B | Promise<B>;
}
