import { readableStreamFromIterable } from "./deps/streams.ts";
import { WritableIterable } from "./writable-iterable.ts";

export type PipeKinds = "piped" | "inherit" | "null";

/** Command options. */
export interface ProcIterOptions {
  /** Current working directory. */
  readonly cwd?: string;
  /** Environment variables. */
  readonly env?: Record<string, string>;

  stdin?: PipeKinds;
  stdout?: PipeKinds;
  stderr?: PipeKinds;
}

export abstract class ProcessError extends Error {
  constructor(public readonly message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ExitCodeError extends ProcessError {
  constructor(public readonly message: string, public readonly code: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SignalError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly signal: Deno.Signal,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class Process implements Deno.Closer {
  constructor(
    protected readonly process: Deno.ChildProcess,
    public readonly options: ProcIterOptions,
    public readonly cmd: string | URL,
    public readonly args: readonly string[],
  ) {}

  private _stderr: AsyncIterable<Uint8Array> | undefined;
  private _stdout: AsyncIterable<Uint8Array> | undefined;
  private _stdin: WritableIterable<Uint8Array> | undefined;

  async close(): Promise<void> {
    if (this._stdin != null) {
      await this.stdin.close();
    }
  }

  get pid() {
    return this.process.pid;
  }

  async status() {
    return await this.process.status;
  }

  get stderr() {
    if (this.options.stderr !== "piped") {
      throw new Deno.errors.NotConnected("stderr only available when 'piped'");
    }

    if (this._stderr == null) {
      const process = this.process;

      this._stderr = {
        async *[Symbol.asyncIterator]() {
          yield* process.stderr;
        },
      };
    }
    return this._stderr;
  }

  get stdout() {
    if (this.options.stdout !== "piped") {
      throw new Deno.errors.NotConnected("stdout only available when 'piped'");
    }

    if (this._stdout == null) {
      const close = this.close.bind(this);
      const process = this.process;

      this._stdout = {
        async *[Symbol.asyncIterator]() {
          try {
            yield* process.stdout;

            const status = await process.status;

            if (status.signal != null) {
              throw new SignalError(
                `signal error: ${status.signal}`,
                status.signal,
              );
            } else if (status.code !== 0) {
              throw new ExitCodeError(`exit code: ${status.code}`, status.code);
            }
          } finally {
            await close();
          }
        },
      };
    }
    return this._stdout;
  }

  get stdin(): WritableIterable<Uint8Array> {
    if (this._stdin == null) {
      const pi = new WritableIterable<Uint8Array>({
        onclose: () => this.stdin.close(),
      });
      readableStreamFromIterable(pi).pipeTo(this.process.stdin);
      this._stdin = pi;
    }
    return this._stdin;
  }
}

export class Command {
  readonly args: readonly string[];

  constructor(
    public readonly options: ProcIterOptions,
    public readonly cmd: string | URL,
    ...args: string[]
  ) {
    this.args = [...args];
  }

  spawn() {
    return new Process(
      new Deno.Command(this.cmd, { ...this.options, args: [...this.args] })
        .spawn(),
      this.options,
      this.cmd,
      this.args,
    );
  }
}
