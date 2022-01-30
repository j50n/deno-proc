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

/**
 * A handler for `AsyncIterable<string>` input.
 * @param autoflush Flush after each line. Defaults to `false`.
 */
export function stringIterableInput(
  autoflush = false,
): InputHandler<AsyncIterable<string>> {
  return new StringIterableInputHandler(autoflush);
}

/**
 * A hander for `AsyncIterable<string>` output.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function stringIterableOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<string>> {
  return new StringIterableOutputHandler(processStderr, errorHandler);
}
