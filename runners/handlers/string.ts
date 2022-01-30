import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import { StringInputHandler, StringOutputHandler } from "./string-handlers.ts";

/**
 * A handler for `string` input.
 */
export function stringInput(): InputHandler<string> {
  return new StringInputHandler();
}

/**
 * A hander for `string` output.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function stringOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<string> {
  return new StringOutputHandler(processStderr, errorHandler);
}
