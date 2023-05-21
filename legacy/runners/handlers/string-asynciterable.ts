import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import {
  StringAsyncIterableInputHandler,
  StringAsyncIterableOutputHandler,
  StringAsyncIterableUnbufferedInputHandler,
  StringAsyncIterableUnbufferedOutputHandler,
} from "./string-asynciterable-handlers.ts";

/**
 * A handler for `AsyncIterable<string>` input.
 * @param autoflush Flush after each line. Defaults to `false`.
 */
export function stringAsyncIterableInput(
  autoflush = false,
): InputHandler<AsyncIterable<string>> {
  return new StringAsyncIterableInputHandler(autoflush);
}

/**
 * A handler for `AsyncIterable<string>` input, unbuffered.
 */
export function stringAsyncIterableUnbufferedInput(): InputHandler<
  AsyncIterable<string>
> {
  return new StringAsyncIterableUnbufferedInputHandler();
}

/**
 * A hander for `AsyncIterable<string>` output.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function stringAsyncIterableOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<string>> {
  return new StringAsyncIterableOutputHandler(processStderr, errorHandler);
}

/**
 * A hander for `AsyncIterable<string>` output, unbuffered.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function stringAsyncIterableUnbufferedOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<string>> {
  return new StringAsyncIterableUnbufferedOutputHandler(
    processStderr,
    errorHandler,
  );
}
