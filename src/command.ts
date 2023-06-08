import { buffer, toBytes, toChunkedLines } from "./transformers.ts";
import { WritableIterable } from "./writable-iterable.ts";

export type PipeKinds = "piped" | "inherit" | "null";

/**
 * Optionally change or suppress the error before it is thrown. Note that this will only
 * be called if either one or both of `error` and `stderrData` is defined (non-`null`).
 *
 * This is a chance to throw a custom error or to suppress throwing an error.
 * You can pass any type of data from the `stderr` handler to the error handler
 * since you own both functions.
 *
 * Throw the error you want to be thrown from the process. If you want to suppress
 * the error, just don't throw an error and return normally. It is good practice to
 * set the error `cause` when wrapping a thrown error.
 */
export type ErrorHandler<S> = (error?: Error, stderrData?: S) => void;

/**
 * Optionally handle lines of stderr (passed as arrays of lines as available), and also
 * optionally return a value that is passed to your custom `ErrorHandler`. **This function
 * may not throw an error**. If you wish to throw an error based on `stderr` data, the
 * `ErrorHandler` function is where you do that.
 */
export type StderrHandler<S> = (it: AsyncIterable<string[]>) => Promise<S>;

/**
 * Options passed to a process.
 */
export interface ProcessOptions<S> {
  /** Current working directory. */
  readonly cwd?: string;
  /** Environment variables. */
  readonly env?: Record<string, string>;

  /** Optionally process all lines of `stderr`. */
  fnStderr?: StderrHandler<S>;
  /** Optionally override error handling. */
  fnError?: ErrorHandler<S>;

  /**
   * Turn on input buffering.
   *
   * Buffering input can improve performance in some cases, but it can also
   * change behavior in subtle ways - in particular if you are expecting a
   * process to respond immediately to written input on an open stream.
   * To prevent confusion, buffering is turned off by default.
   */
  buffer?: boolean;
}

/** Command options. */
export interface ProcessStreamOptions<T> extends ProcessOptions<T> {
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
    public readonly command: string[],
    public readonly options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

export class ExitCodeError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly command: string[],
    public readonly code: number,
    public readonly options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

export class SignalError extends ProcessError {
  constructor(
    public readonly message: string,
    public readonly command: string[],
    public readonly signal: Deno.Signal,
    public readonly options?: { cause?: Error },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
  }
}

/**
 * A wrapper for `Deno.ChildProcess` that converts streams to `AsyncIterable<...>`,
 * corrects error handling, and adds other custom stuff.
 */
export class Process<S> implements Deno.Closer {
  private stderrResult: Promise<S> | undefined;

  constructor(
    protected readonly process: Deno.ChildProcess,
    public readonly options: ProcessStreamOptions<S>,
    public readonly cmd: string | URL,
    public readonly args: readonly string[],
  ) {
    if (options.fnStderr != null) {
      this.stderrResult = options.fnStderr(toChunkedLines(process.stderr));
    }
  }

  private _stderr: AsyncIterable<Uint8Array> | undefined;
  private _stdout: AsyncIterable<Uint8Array> | undefined;
  private _stdin:
    | WritableIterable<Uint8Array | Uint8Array[] | string | string[]>
    | undefined;

  private _isClosed = false;
  private _passError: Error | undefined;

  get isClosed(): boolean {
    return this._isClosed;
  }

  async close(): Promise<void> {
    if (!this.isClosed) {
      this._isClosed = true;

      if (this._stdin != null) {
        await this._stdin.close();
      }
    }
  }

  get pid() {
    return this.process.pid;
  }

  async status() {
    return await this.process.status;
  }

  get stderr(): AsyncIterable<Uint8Array> {
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

  get stdout(): AsyncIterable<Uint8Array> {
    if (this.options.stdout !== "piped") {
      throw new Deno.errors.NotConnected("stdout only available when 'piped'");
    }

    if (this._stdout == null) {
      const close = this.close.bind(this);
      const process = this.process;
      const cmd = [this.cmd, ...this.args].map((it) => it.toString());

      const passError = () => this._passError;

      const catchHandler = async (error?: Error) => {
        const errorHandler = this.options.fnError;

        if (errorHandler != null) {
          const stderrResult = async () => {
            if (this.stderrResult == null) {
              return {};
            } else {
              const stderrData: S = await this.stderrResult;
              return { stderrData };
            }
          };

          const { stderrData } = await stderrResult();

          if (error != null || stderrData != null) {
            try {
              errorHandler(
                error,
                stderrData,
              );
            } catch (handledError) {
              throw handledError;
            }
          }
        } else {
          if (error != null) {
            throw error;
          }
        }
      };

      this._stdout = {
        async *[Symbol.asyncIterator]() {
          try {
            let error: Error | undefined;
            try {
              yield* process.stdout;

              const status = await process.status;
              const cause = passError();

              if (status.signal != null) {
                throw new SignalError(
                  `signal error: ${status.signal}`,
                  cmd,
                  status.signal,
                  cause == null ? undefined : { cause },
                );
              } else if (status.code !== 0) {
                throw new ExitCodeError(
                  `exit code: ${status.code}`,
                  cmd,
                  status.code,
                  cause == null ? undefined : { cause },
                );
              } else if (cause) {
                throw new StreamError(
                  cause.message,
                  cmd,
                  cause == null ? undefined : { cause },
                );
              }
            } catch (e) {
              error = e;
            }
            await catchHandler(error);
          } finally {
            await close();
          }
        },
      };
    }
    return this._stdout;
  }

  /**
   * `stdin` as a {@link WritableIterable}.
   */
  get stdin(): WritableIterable<Uint8Array | Uint8Array[] | string | string[]> {
    if (this._stdin == null) {
      const pi = new WritableIterable<
        Uint8Array | Uint8Array[] | string | string[]
      >();
      this.writeToStdin(pi);
      this._stdin = pi;
    }
    return this._stdin;
  }

  /**
   * This is the "backdoor" way to write directly to the underlying process `stdin`
   * without the overhead of a {@link WritableIterable}. Use instead of {@link stdin}
   * for streamed data.
   *
   * {@link stdin} is the way to go if you are passing ad-hoc, non-continuous data to
   * process `stdin`. However, it adds a substantial amount of overhead, and it is very
   * slow for processing small data. Using this function instead of {@link stdin} greatly
   * improves performance where small data is a factor.
   *
   * @param iter The data being passed to the underlying process `stdin`.
   */
  writeToStdin(
    iter: AsyncIterable<Uint8Array | Uint8Array[] | string | string[]>,
  ) {
    if (this.options.stdin !== "piped") {
      throw new Deno.errors.NotConnected("stdin only available when 'piped'");
    }

    const bufferInput = this.options.buffer === true;

    const writer = this.process.stdin.getWriter();

    let writerIsClosed = false;
    const closeWriter = async () => {
      if (!writerIsClosed) {
        writerIsClosed = true;
        try {
          await writer.close();
        } catch (e) {
          if (!(e instanceof TypeError)) {
            if (this._passError == null) {
              this._passError = e;
            }
          }
        }
      }
    };

    (async () => {
      try {
        for await (const it of buffer(bufferInput ? 16384 : 0)(toBytes(iter))) {
          if (writerIsClosed) {
            break;
          }

          await writer.write(it);
        }
      } catch (e) {
        if (
          this._passError == null &&
          !(e instanceof Deno.errors.BrokenPipe)
        ) {
          this._passError = e;
        }
      } finally {
        await closeWriter();
      }
    })();
  }
}

/**
 * A factory for [[Process]].
 */
export class Command<S> {
  readonly args: readonly string[];

  constructor(
    public readonly options: ProcessStreamOptions<S>,
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
