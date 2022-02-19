import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import {
  BytesAsyncIterableInputHandler,
  BytesAsyncIterableOutputHandler,
  BytesAsyncIterableUnbufferedInputHandler,
  BytesAsyncIterableUnbufferedOutputHandler,
} from "./bytes-asynciterable-handlers.ts";

/**
 * A handler for `AsyncIterable<Uint8Array>` input.
 */
export function bytesAsyncIterableInput(): InputHandler<
  AsyncIterable<Uint8Array>
> {
  return new BytesAsyncIterableInputHandler();
}

/**
 * A handler for `AsyncIterable<Uint8Array>` input, unbuffered.
 */
export function bytesAsyncIterableUnbufferedInput(): InputHandler<
  AsyncIterable<Uint8Array>
> {
  return new BytesAsyncIterableUnbufferedInputHandler();
}

/**
 * A hander for `AsyncIterable<Uint8Array>` output.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function bytesAsyncIterableOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<Uint8Array>> {
  return new BytesAsyncIterableOutputHandler(processStderr, errorHandler);
}

/**
 * A hander for `AsyncIterable<Uint8Array>` output, unbuffered.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function bytesAsyncIterableUnbufferedOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<Uint8Array>> {
  return new BytesAsyncIterableUnbufferedOutputHandler(
    processStderr,
    errorHandler,
  );
}
