import { MultiCloseWriter } from "./closers.ts";
import { pump } from "./utility.ts";

/**
 * Immediately close the `stdin` of the process; no data.
 * @param _input No input defined.
 * @param stdin The stdin of the process.
 */
export async function stdinNull(
  _input: undefined,
  stdin: MultiCloseWriter,
): Promise<void> {
  stdin.close();
  await Promise.resolve(undefined);
}

/**
 * Get data for `stdin` from a `Reader`.
 * @param input The reader.
 * @param stdin The stdin of the process.
 */
export async function stdinReader(
  input: Deno.Reader & Deno.Closer,
  stdin: MultiCloseWriter,
): Promise<void> {
  await pump(input, stdin);
}
