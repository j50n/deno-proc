import { BufWriter } from "../../deps.ts";
import { ChainedError } from "../chained-error.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { ErrorHandler } from "../error-support.ts";
import { InputHandler } from "../proc-group.ts";
import { StderrProcessor } from "../stderr-support.ts";
import { DEFAULT_BUFFER_SIZE } from "../utility.ts";
import { AbstractTextOutputHandler } from "./abstract-handlers.ts";

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
        throw new ChainedError(`${this.constructor.name}.processInput`, e);
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
    processStderr: StderrProcessor,
    errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  async *processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ): AsyncIterableIterator<string> {
    yield* this.process(stdout, stderr, process, input);
  }
}
