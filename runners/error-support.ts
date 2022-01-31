import { RunOptions } from "./proc-group.ts";
import { ProcessExitError } from "./process-exit-error.ts";

export type ErrorHandler = (
  options: RunOptions,
  status: Deno.ProcessStatus,
  stderrLines?: string[] | unknown,
) => void;

export function defaultErrorHandling(
  options: RunOptions,
  status: Deno.ProcessStatus,
  stderrLines?: string[] | unknown,
): void {
  if (!status.success) {
    throw new ProcessExitError(
      `process exited with code: ${status.code}`,
      status.code,
      options,
      status.signal,
      Array.isArray(stderrLines) ? stderrLines : undefined,
    );
  }
}
