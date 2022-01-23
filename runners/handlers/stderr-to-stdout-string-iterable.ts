import { MultiCloseProcess, MultiCloseReader } from "../closers.ts";
import { OutputHandler } from "../process-group.ts";
import { readerToLines } from "../utility.ts";
import { MuxAsyncIterator } from "../../deps.ts";

export function StderrToStdoutStringIterableOutput() {
  return new StderrToStdoutStringIterableOutputHandler();
}

/**
 * Abstract class for handling text output.
 */
export class StderrToStdoutStringIterableOutputHandler
  implements OutputHandler<AsyncIterable<string>> {
  processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): AsyncIterable<string> {
    return this.process(stdout, stderr, process, input);
  }

  protected async *handleStderr(
    stderr: MultiCloseReader,
  ): AsyncIterableIterator<string> {
    try {
      yield* readerToLines(stderr);
    } catch (e) {
      if (e instanceof Deno.errors.Interrupted) {
        // Ignore.
      } else {
        throw e;
      }
    } finally {
      stderr.close();
    }
  }

  protected async *process(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): AsyncIterableIterator<string> {
    try {
      const mux = new MuxAsyncIterator<string>();
      mux.add(this.handleStderr(stderr));
      mux.add(readerToLines(stdout));

      yield* mux;

      await input;

      const status = await process.status();

      //TODO: This won't work for all cases, if error code isn't standard.
      if (!status.success) {
        //TODO: Specialize error; add signal
        throw new Error(`process exited with code: ${status.code}`);
      }
    } finally {
      stdout.close();
      process.close();
    }
  }
}
