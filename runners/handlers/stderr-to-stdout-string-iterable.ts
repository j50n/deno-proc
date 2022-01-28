import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { StderrToStdoutStringIterableOutputHandler } from "./stderr-to-stdout-string-iterable-handlers.ts";

/**
 * Redirect `stderr` into `stdout` so that you get both, as lines, for output.
 *
 * The order of the lines is not guaranteed. The timing of the lines is not guaranteed.
 *
 * @param errorHandler Error handler.
 * @returns `stdout` and `stderr` lines as an `AsyncIterable`.
 */
export function stderrToStdoutStringIterableOutput(
  errorHandler: ErrorHandler = defaultErrorHandling,
) {
  return new StderrToStdoutStringIterableOutputHandler(errorHandler);
}
