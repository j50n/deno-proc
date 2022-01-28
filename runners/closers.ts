import { Deferred, deferred } from "../deps.ts";
import { GroupImpl } from "./proc-group-impl.ts";
import { RunOptions } from "./proc-group.ts";

/**
 * Wrapper for a `Reader & Closer` that allows you to safely call {@link close()} multiple times.
 */
export class MultiCloseReader implements Deno.Reader, Deno.Closer {
  private closed = false;

  private _done: Deferred<void> = deferred();

  constructor(private readonly reader: Deno.Reader & Deno.Closer) {
  }

  async read(p: Uint8Array): Promise<number | null> {
    const data = await this.reader.read(p);
    if (data === null) {
      this._done.resolve();
    }
    return data;
  }

  close(): void {
    if (!this.closed) {
      try {
        this.closed = true;
        this.reader.close();
      } finally {
        this._done.resolve();
      }
    }
  }

  get done(): Promise<void> {
    return this._done;
  }
}

/**
 * Wrapper for a `Writer & Closer` that allows you to safely call {@link close()} multiple times.
 */
export class MultiCloseWriter implements Deno.Writer, Deno.Closer {
  private closed = false;

  constructor(private readonly writer: Deno.Writer & Deno.Closer) {
  }

  async write(p: Uint8Array): Promise<number> {
    return await this.writer.write(p);
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.writer.close();
    }
  }
}

/**
 * Wrapper for a Deno process that ensures it is only closed once, even though we may try
 * to close it multiple times.
 */
export class MultiCloseProcess implements Deno.Closer {
  private closed = false;

  constructor(
    private readonly process: Deno.Process,
    public readonly options: RunOptions,
    public readonly group: GroupImpl,
  ) {
  }

  async status(): Promise<Deno.ProcessStatus> {
    return await this.process.status();
  }

  get pid(): number {
    return this.process.pid;
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.process.close();
    }
  }
}

/**
 * A `Reader`/`Closer` that suppresses the `close()` method on the underlying reader.
 */
export class NoCloseReader implements Deno.Reader, Deno.Closer {
  constructor(public readonly reader: Deno.Reader) {
  }

  read(p: Uint8Array): Promise<number | null> {
    return this.reader.read(p);
  }

  close(): void {
    //Noop.
  }
}

// /**
//  * A standard {@link StringReader} with a noop `close()`.
//  */
// export class ClosableStringReader extends StringReader implements Deno.Closer {
//   constructor(input: string) {
//     super(input);
//   }

//   close(): void {
//     // Noop.
//   }
// }
