import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import {
  BytesIterableInputHandler,
  BytesIterableOutputHandler,
  BytesIterableUnbufferedInputHandler,
  BytesIterableUnbufferedOutputHandler,
} from "./bytes-iterable-handlers.ts";

/**
 * A handler for `AsyncIterable<Uint8Array>` input.
 */
export function bytesIterableInput(): InputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableInputHandler();
}

/**
 * A handler for `AsyncIterable<Uint8Array>` input, unbuffered.
 */
export function bytesIterableUnbufferedInput(): InputHandler<
  AsyncIterable<Uint8Array>
> {
  return new BytesIterableUnbufferedInputHandler();
}

/**
 * A hander for `AsyncIterable<Uint8Array>` output.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function bytesIterableOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableOutputHandler(processStderr, errorHandler);
}

/**
 * A hander for `AsyncIterable<Uint8Array>` output, unbuffered.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function bytesIterableUnbufferedOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableUnbufferedOutputHandler(processStderr, errorHandler);
}
