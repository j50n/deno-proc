import { ChainedError } from "./chained-error.ts";
import { MultiCloseReader, MultiCloseWriter } from "./closers.ts";
import { BufReader, BufWriter } from "./deps/io.ts";
import { TextProtoReader } from "./deps/textproto.ts";

export interface ProcParams {
  /** The command to run. */
  cmd: string[];

  /** A hack to allow `stderr` to be piped. */
  pipeStderr?: boolean;

  /** Set the current working directory for the process. */
  cwd?: string;
}

export class ProcessExitError extends ChainedError {
}

/**
 * Run a child process.
 * @param params Process parameters.
 * @returns The child process.
 */
export function run(params: ProcParams): Proc {
  return new Proc(params);
}

/**
 * A child process. Requires `--allow-run` permissions.
 */
export class Proc implements Deno.Closer {
  private upstreamError: Error | undefined;

  private processClosed = false;
  private process: Deno.Process;

  private _status: Deno.ProcessStatus | undefined;

  /**
   * The current status of this process. If the process has not yet
   * completed, the status will be `undefined`.
   */
  get status(): Deno.ProcessStatus | undefined {
    return this._status;
  }

  private readonly stdout: Deno.Reader & Deno.Closer;
  private readonly stdin: Deno.Writer & Deno.Closer;
  private readonly stderr: undefined | Deno.Reader & Deno.Closer;

  constructor(protected readonly params: ProcParams) {
    this.process = Deno.run({
      cmd: params.cmd,
      cwd: params.cwd,
      stdout: "piped",
      stderr: params.pipeStderr ? "piped" : "inherit",
      stdin: "piped",
    });
    this.stdout = new MultiCloseReader(this.process.stdout!);
    this.stdin = new MultiCloseWriter(this.process.stdin!);
    this.stderr = params.pipeStderr
      ? new MultiCloseReader(this.process.stderr!)
      : undefined;
  }

  private async closeProcess(): Promise<void> {
    if (!this.processClosed) {
      this._status = await this.process.status();
      this.processClosed = true;
      try {
        this.process.close();
      } catch (e) {
        console.debug(`process close failed: ${e}`);
      }
    }

    if (this.status?.code) {
      throw new Error(
        `process exited with error code ${this.status?.code} [${
          this.params.cmd.join(" ")
        }]`,
        this.upstreamError,
      );
    } else if (this.upstreamError) {
      throw this.upstreamError;
    }
  }

  /**
   * Close the process and all open streams in or out. You should not
   * need to call this explicitly in most cases. It is safe to close
   * a process multiple times.
   */
  async close(): Promise<void> {
    this.stdout.close();
    this.stdin.close();
    this.stderr?.close();
    await this.closeProcess();
  }

  kill(): void {
    this.process.kill("SIGTERM");
    if (!this.processClosed) {
      this.processClosed = true;
      this.process.close();
    }
    this.stdout.close();
    this.stdin.close();
    this.stderr?.close();
  }

  /**
   * Pipe `stdout` of this process into `stdin` of that process.
   * @param that That process.
   * @returns That process, for chaining.
   */
  pipe(that: Proc): Proc {
    (async () => {
      await this.pump(this.stdout, that.stdin);
      try {
        await this.close();
      } catch (e) {
        if (e instanceof Error) {
          that.upstreamError = e;
        }
      }
    })();

    return that;
  }

  /**
   * Return `stdout` as lines of text, lazily.
   */
  async *stdoutLines(): AsyncIterableIterator<string> {
    try {
      const reader = new TextProtoReader(new BufReader(this.stdout));
      while (true) {
        const line = await reader.readLine();
        if (line === null) {
          break;
        }
        yield line;
      }
    } finally {
      await this.close();
    }
  }

  /**
   * Return `stderr` as lines of text, lazily.
   */
  async *stderrLines(): AsyncIterableIterator<string> {
    if (!this.stderr) {
      throw new Error("stderr is undefined; set pipeStderr flag");
    }

    try {
      const reader = new TextProtoReader(new BufReader(this.stderr));
      while (true) {
        const line = await reader.readLine();
        if (line === null) {
          break;
        }
        yield line;
      }
    } finally {
      await this.close();
    }
  }

  private async pump(
    input: Deno.Reader & Deno.Closer,
    output: Deno.Writer & Deno.Closer,
  ): Promise<void> {
    try {
      try {
        const reader = new BufReader(input);
        const writer = new BufWriter(output);
        const buffer = new Uint8Array(4092);

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
}
