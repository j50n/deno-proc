import { readableStreamFromIterable } from "./deps/streams.ts";
import { concat } from "./utility.ts";
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
  constructor(public readonly message: string, options?: { cause?: Error }) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

export class ExitCodeError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly code: number,
    options: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

export class SignalError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly signal: Deno.Signal,
    options: { cause?: Error },
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

      const getPassthruError = () => this._passthruError;

      this._stdout = {
        async *[Symbol.asyncIterator]() {
          try {
            yield* process.stdout;

            const status = await process.status;

            if (status.signal != null) {
              throw new SignalError(
                `signal error: ${status.signal}`,
                status.signal,
                { cause: getPassthruError() },
              );
            } else if (status.code !== 0) {
              throw new ExitCodeError(
                `exit code: ${status.code}`,
                status.code,
                { cause: getPassthruError() },
              );
            }
          } finally {
            await close();
          }
          if (getPassthruError() != null) {
            throw getPassthruError();
          }
        },
      };
    }
    return this._stdout;
  }

  get stdin(): WritableIterable<Uint8Array | Uint8Array[] | string | string[]> {
    if (this._stdin == null) {
      const encoder = new TextEncoder();
      const lf = encoder.encode("\n");

      const pi = new WritableIterable<
        Uint8Array | Uint8Array[] | string | string[]
      >({
        onclose: () => this.stdin.close(),
      });

      const setPassthruError = (err: Error) => this._passthruError = err;

      readableStreamFromIterable({
        async *[Symbol.asyncIterator]() {
          try {
            for await (const item of pi) {
              if (item instanceof Uint8Array) {
                yield item;
              } else if (typeof item === "string") {
                yield encoder.encode(item);
              } else if (Array.isArray(item)) {
                for (const piece of item) {
                  const lines: Uint8Array[] = [];
                  if (piece instanceof Uint8Array) {
                    lines.push(piece);
                    lines.push(lf);
                  } else if (typeof piece === "string") {
                    lines.push(encoder.encode(piece));
                    lines.push(lf);
                  }
                  yield concat(lines);
                }
              }
            }
          } catch (e) {
            setPassthruError(e);
          } finally {
            pi.close();
          }
        },
      }).pipeTo(this.process.stdin);
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
