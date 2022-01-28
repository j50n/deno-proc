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
    let details: string | undefined = undefined;
    if (Array.isArray(stderrLines)) {
      details = stderrLines.map((line) => `\t${line}`).join("\n");
    }

    throw new ProcessExitError(
      `process exited with code: ${status.code}`,
      status.code,
      options,
      status.signal,
      details,
    );
  }
}
