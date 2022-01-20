type Stdin = Deno.Writer & Deno.Closer;
type Stdout = Deno.Reader & Deno.Closer;
type Stderr = Stdout;

type FnInput<A> = (input: A, stdin: Stdin) => Promise<void>;
type FnOutput<B> = (
  stdout: Stdout,
  stderr: Stderr,
  exitCode: Promise<Deno.ProcessStatus>,
) => Promise<B>;

interface RunOptions {
  cmd: string[] | [URL, ...string[]];
  cwd?: string;
  env?: {
    [key: string]: string;
  };
}

export class ProcGroup implements Deno.Closer {
  close(): void {
    throw new Error("Method not implemented.");
  }

  async run<A, B>(
    fnInput: FnInput<A>,
    fnOutput: FnOutput<B>,
    input: A,
    options: RunOptions,
  ): Promise<B> {
    const p = Deno.run({
      ...options,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    fnInput(input, p.stdin);
    return await fnOutput(p.stdout, p.stderr, p.status());
  }
}
