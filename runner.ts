import { MultiCloseReader, MultiCloseWriter } from "./closers.ts";

type Stdin = Deno.Writer & Deno.Closer;
type Stdout = Deno.Reader & Deno.Closer;
type Stderr = Stdout;

type FnInput<A> = (input: A, stdin: Stdin) => Promise<void>;
type FnOutput<B> = (
  stdout: Stdout,
  stderr: Stderr,
  process: Deno.Process,
) => Promise<B>;

interface RunOptions {
  cmd: string[] | [URL, ...string[]];
  cwd?: string;
  env?: {
    [key: string]: string;
  };
}


interface Process {
    process: Deno.Process;
    stdin: Stdin;
    stdout: Stdout;
    stderr: Stderr;
}

export class ProcessGroup implements Deno.Closer {
    protected processes: Process[] = [];

  close(): void {
    while(this.processes.length > 0){
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

    this.processes.push({process, stdin, stdout, stderr});

    fnInput(input, stdin);
    return await fnOutput(stdout, stderr, process);
  }
}
