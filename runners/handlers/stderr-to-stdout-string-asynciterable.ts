import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { StderrToStdoutStringAsyncIterableOutputHandler } from "./stderr-to-stdout-string-asynciterable-handlers.ts";

/**
 * Redirects `stderr` into `stdout` so that you get both, as lines, for output.
 *
 * The order of the lines is not guaranteed. The timing of the lines is not guaranteed.
 * The operation is fully unbuffered so that the lines come out in the correct order,
 * at least as much as possible.
 *
 * @param errorHandler Custom error handler.
 */
export function stderrToStdoutStringAsyncIterableOutput(
  errorHandler: ErrorHandler = defaultErrorHandling,
) {
  return new StderrToStdoutStringAsyncIterableOutputHandler(errorHandler);
}
