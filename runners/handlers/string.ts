import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import { StringInputHandler, StringOutputHandler } from "./string-handlers.ts";

export function stringInput(): InputHandler<string> {
  return new StringInputHandler();
}

export function stringOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<string> {
  return new StringOutputHandler(processStderr, errorHandler);
}
