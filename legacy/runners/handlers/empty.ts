import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import { EmptyInputHandler, EmptyOutputHandler } from "./empty-handlers.ts";

/**
 * A hander for `void` input.
 */
export function emptyInput() {
  return new EmptyInputHandler();
}

/**
 * Dump `stdout` to the `stdout` of the parent process, unbuffered.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function emptyOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<void> {
  return new EmptyOutputHandler(processStderr, errorHandler);
}
