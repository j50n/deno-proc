import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import {
  StringIterableInputHandler,
  StringIterableOutputHandler,
} from "./string-iterable-handlers.ts";

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
