import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import {
  BytesIterableInputHandler,
  BytesIterableOutputHandler,
} from "./bytes-iterable-handlers.ts";

export function bytesIterableInput(
  autoflush = true,
): InputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableInputHandler(autoflush);
}

export function bytesIterableOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableOutputHandler(processStderr, errorHandler);
}
