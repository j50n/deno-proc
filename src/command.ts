import { toBytes } from "./utility.ts";
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
  constructor(
    public readonly message: string,
    public readonly options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

export class StreamError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly command: string,
    public readonly options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

export class ExitCodeError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly command: string,
    public readonly code: number,
    public readonly options: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

export class SignalError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly command: string,
    public readonly signal: Deno.Signal,
    public readonly options: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
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
  private _stdin:
    | WritableIterable<Uint8Array | Uint8Array[] | string | string[]>
    | undefined;

  private _isClosed = false;
  private _passthruError: Error | undefined;

  get isClosed(): boolean {
    return this._isClosed;
  }

  async close(): Promise<void> {
    if (!this.isClosed) {
      this._isClosed = true;

      if (this._stdin != null) {
        await this.stdin.close();
      }
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
          try {
            yield* process.stderr;
          } catch (e) {
            //TODO: stderr needs some TLC
            console.dir("[STDERR]", e);
          }
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
      const cmd = this.cmd;

      const passError = () =>
        this._passthruError == null
          ? undefined
          : new StreamError(this._passthruError.message, this.cmd.toString(), {
            cause: this._passthruError,
          });

      this._stdout = {
        async *[Symbol.asyncIterator]() {
          try {
            yield* process.stdout;

            const status = await process.status;

            if (status.signal != null) {
              throw new SignalError(
                `signal error: ${status.signal}`,
                cmd.toString(),
                status.signal,
                { cause: passError() },
              );
            } else if (status.code !== 0) {
              throw new ExitCodeError(
                `exit code: ${status.code}`,
                cmd.toString(),
                status.code,
                { cause: passError() },
              );
            }
          } catch (e) {
            throw e;
          } finally {
            await close();
          }
          const pte = passError();
          if (pte) {
            throw pte;
          }
        },
      };
    }
    return this._stdout;
  }

  get stdin(): WritableIterable<Uint8Array | Uint8Array[] | string | string[]> {
    if (this._stdin == null) {
      const writer = this.process.stdin.getWriter();

      let writerIsClosed = false;
      const closeWriter = async () => {
        if (!writerIsClosed) {
          writerIsClosed = true;
          try {
            await writer.close();
          } catch (e) {
            if (!(e instanceof TypeError)) {
              if (this._passthruError == null) {
                this._passthruError = e;
              }
            }
          }
        }
      };

      const pi = new WritableIterable<
        Uint8Array | Uint8Array[] | string | string[]
      >();

      (async () => {
        try {
          for await (const it of toBytes(pi)) {
            if (writerIsClosed) {
              break;
            }

            await writer.write(it);
          }
        } catch (e) {
          if (
            this._passthruError == null && !(e instanceof Deno.errors.BrokenPipe)
          ) {
            this._passthruError = e;
          }
        } finally {
          await closeWriter();
        }
      })();
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
