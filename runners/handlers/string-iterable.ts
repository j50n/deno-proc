import { BufWriter } from "../../deps.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import { DEFAULT_BUFFER_SIZE } from "../utility.ts";
import { AbstractTextOutputHandler } from "./abstract-handlers.ts";

export function stringIterableInput(
  autoflush = true,
): InputHandler<AsyncIterable<string>> {
  return new StringIterableInputHandler(autoflush);
}

export function stringIterableOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<string>> {
  return new StringIterableOutputHandler(processStderr, errorHandler);
}

/**
 * Source `stdin` from an iterable of lines.
 */
export class StringIterableInputHandler
  implements InputHandler<AsyncIterable<string>> {
  constructor(public readonly autoflush: boolean) {
  }

  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: AsyncIterable<string>,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const cr = encoder.encode("\n");

      const bw = new BufWriter(stdin, DEFAULT_BUFFER_SIZE);
      for await (const line of input) {
        await bw.write(encoder.encode(line));
        await bw.write(cr);
        if (this.autoflush) {
          await bw.flush();
        }
      }
      await bw.flush();
    } catch (e) {
      if (
        e instanceof Deno.errors.BrokenPipe ||
        e instanceof Deno.errors.Interrupted
      ) {
        // Ignore.
      } else {
        throw e;
      }
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as an iterable over the lines.
 */
export class StringIterableOutputHandler
  extends AbstractTextOutputHandler<AsyncIterable<string>> {
  constructor(
    public readonly processStderr: StderrProcessor,
    public readonly errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<void> },
  ): AsyncIterable<string> {
    return this.process(stdout, stderr, process, input);
  }
}
