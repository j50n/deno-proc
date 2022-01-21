import {
  BufReader,
  BufWriter,
} from "https://deno.land/std@0.121.0/io/buffer.ts";
import { TextProtoReader } from "https://deno.land/std@0.121.0/textproto/mod.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "./closers.ts";

type Stdin = Deno.Writer & Deno.Closer;
type Stdout = Deno.Reader & Deno.Closer;
type Stderr = Stdout;

type FnInput<A> = (input: A, stdin: Stdin) => Promise<void>;
type FnOutput<B> = (
  stdout: Stdout,
  stderr: Stderr,
  process: MultiCloseProcess,
) => Promise<B>;

interface RunOptions {
  cmd: string[] | [URL, ...string[]];
  cwd?: string;
  env?: {
    [key: string]: string;
  };
}

interface Process {
  process: MultiCloseProcess;
  stdin: Stdin;
  stdout: Stdout;
  stderr: Stderr;
}

export class ProcessGroup implements Deno.Closer {
  protected processes: Process[] = [];

  close(): void {
    while (this.processes.length > 0) {
      const p = this.processes.pop()!;
      p.stdin.close();
      p.stdout.close();
      p.stderr.close();
      p.process.close();
    }
  }

  async run<A, B>(
    fnInput: FnInput<A>,
    fnOutput: FnOutput<B>,
    input: A,
    options: RunOptions,
  ): Promise<B> {
    const process = Deno.run({
      ...options,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const stdin = new MultiCloseWriter(process.stdin);
    const stdout = new MultiCloseReader(process.stdout);
    const stderr = new MultiCloseReader(process.stderr);

    const mcp = new MultiCloseProcess(process);

    this.processes.push({ process: mcp, stdin, stdout, stderr });

    fnInput(input, stdin);
    return await fnOutput(stdout, stderr, mcp);
  }
}

/**
 * Immediately close the `stdin` of the process; no data.
 * @param _input No input defined.
 * @param stdin The stdin of the process.
 */
export async function stdinNull(
  _input: undefined,
  stdin: Stdin,
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
  stdin: Stdin,
): Promise<void> {
  await pump(input, stdin);
}

async function pump(
  input: Deno.Reader & Deno.Closer,
  output: Deno.Writer & Deno.Closer,
): Promise<void> {
  try {
    try {
      const reader = new BufReader(input);
      const writer = new BufWriter(output);
      const buffer = new Uint8Array(16368);
      while (true) {
        const len = await reader.read(buffer);
        if (len === null) {
          break;
        }
        await writer.write(buffer.slice(0, len));
      }
      await writer.flush();
    } finally {
      input.close();
    }
  } finally {
    output.close();
  }
}

// (
//     stdout: Stdout,
//     stderr: Stderr,
//     process: Deno.Process,
//   ) => Promise<B>

export function stdoutLines(
  stdout: Stdout,
  stderr: Stderr,
  process: MultiCloseProcess,
): Promise<AsyncIterableIterator<string>> {
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

  return Promise.resolve(handleStdout());
}

async function* reader2Lines(
  input: Deno.Reader & Deno.Closer,
): AsyncIterableIterator<string> {
  try {
    const reader = new TextProtoReader(new BufReader(input));
    while (true) {
      const line = await reader.readLine();
      if (line === null) {
        break;
      }
      yield line;
    }
  } finally {
    input.close();
  }
}
