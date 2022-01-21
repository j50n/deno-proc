import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "./closers.ts";

// export type Stdin = Deno.Writer & Deno.Closer;
// export type Stdout = Deno.Reader & Deno.Closer;
// export type Stderr = Stdout;

type FnInput<A> = (input: A, stdin: MultiCloseWriter) => Promise<void>;
type FnOutput<B> = (
  stdout: MultiCloseReader,
  stderr: MultiCloseReader,
  process: MultiCloseProcess,
  input: Promise<void>,
) => B | Promise<B>;

interface RunOptions {
  cmd: string[] | [URL, ...string[]];
  cwd?: string;
  env?: {
    [key: string]: string;
  };
}

interface Process {
  process: MultiCloseProcess;
  stdin: MultiCloseWriter;
  stdout: MultiCloseReader;
  stderr: MultiCloseReader;
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

    const inputPromise = fnInput(input, stdin);
    return await fnOutput(stdout, stderr, mcp, inputPromise);
  }
}
