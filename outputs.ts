import { MultiCloseProcess, MultiCloseReader } from "./closers.ts";
import { reader2Lines } from "./utility.ts";

export function stdoutLines(
  stdout: MultiCloseReader,
  stderr: MultiCloseReader,
  process: MultiCloseProcess,
  input: Promise<void>,
): AsyncIterableIterator<string> {
  async function handleStderr(): Promise<void> {
    try {
      for await (const line of reader2Lines(stderr)) {
        // TODO: Make this call asynchronous.
        console.error(line);
      }
    } catch (e) {
      if (e instanceof Deno.errors.Interrupted) {
        // Ignore.
      } else {
        throw e;
      }
    } finally {
      stderr.close();
    }
  }

  const se = handleStderr();

  async function* handleStdout(): AsyncIterableIterator<string> {
    try {
      for await (const line of reader2Lines(stdout)) {
        yield line;
      }

      await input;
      await se;

      const status = await process.status();

      if (!status.success) {
        //TODO: Specialize error; add signal
        throw new Error(`process exited with code: ${status.code}`);
      }
    } finally {
      stdout.close();
      process.close();
    }
  }

  return handleStdout();
}
