import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { ErrorHandler } from "../error-support.ts";
import { InputHandler } from "../proc-group.ts";
import { StderrProcessor } from "../stderr-support.ts";
import { AbstractBytesUnbufferedOutputHandler } from "./abstract-handlers.ts";

/**
 * Empty `stdin`.
 */
export class EmptyInputHandler implements InputHandler<void> {
  get failOnEmptyInput(): boolean {
    return false;
  }

  async processInput(_input: void, stdin: MultiCloseWriter): Promise<void> {
    stdin.close();
    await Promise.resolve(undefined);
  }
}

/**
 * Write lines of `stdout` to `stdout` of the parent process, unbuffered.
 */
export class EmptyOutputHandler
  extends AbstractBytesUnbufferedOutputHandler<void> {
  constructor(
    processStderr: StderrProcessor,
    errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  async processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ): Promise<void> {
    for await (const bytes of this.process(stdout, stderr, process, input)) {
      Deno.stdout.writeSync(bytes);
    }
  }
}
