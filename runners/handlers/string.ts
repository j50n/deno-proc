import { StringReader } from "../../deps.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
  NoCloseReader,
} from "../closers.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import { stderrLinesToConsoleError } from "../stderr-support.ts";
import { pump } from "../utility.ts";
import { AbstractTextOutputHandler } from "./abstract-handlers.ts";

export function stringInput(): InputHandler<string> {
  return new StringInputHandler();
}

export function stringOutput(
  processStderr: (
    lines: AsyncIterable<string>,
  ) => Promise<unknown | string[]> = stderrLinesToConsoleError,
): OutputHandler<string> {
  return new StringOutputHandler(processStderr);
}

/**
 * Source `stdin` from a `string`. `stdin` is closed once the text data is written.
 */
export class StringInputHandler implements InputHandler<string> {
  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(input: string, stdin: MultiCloseWriter): Promise<void> {
    try {
      await pump(new NoCloseReader(new StringReader(input)), stdin);
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as a `string`.
 */
export class StringOutputHandler extends AbstractTextOutputHandler<string> {
  constructor(
    processStderr: (
      lines: AsyncIterable<string>,
    ) => Promise<unknown | string[]>,
  ) {
    super(processStderr);
  }

  async processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): Promise<string> {
    const lines = [];
    for await (const line of this.process(stdout, stderr, process, input)) {
      lines.push(line);
    }
    return lines.join("\n");
  }
}
