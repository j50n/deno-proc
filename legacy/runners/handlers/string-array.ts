import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import {
  StringArrayInputHandler,
  StringArrayOutputHandler,
} from "./string-array-handlers.ts";

/**
 * A handler for `string[]` input.
 */
export function stringArrayInput(): InputHandler<string[]> {
  return new StringArrayInputHandler();
}

/**
 * A hander for `string[]` output.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function stringArrayOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<string[]> {
  return new StringArrayOutputHandler(processStderr, errorHandler);
}
