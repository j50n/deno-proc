/**
 * Wrapper for a `Reader & Closer` that allows you to safely call {@link close()} multiple times.
 */
export class MultiCloseReader implements Deno.Reader, Deno.Closer {
  private closed = false;

  constructor(private readonly reader: Deno.Reader & Deno.Closer) {
  }

  async read(p: Uint8Array): Promise<number | null> {
    return await this.reader.read(p);
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.reader.close();
    }
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

  constructor(private readonly process: Deno.Process) {
  }

  async status(): Promise<Deno.ProcessStatus> {
    return await this.process.status();
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.process.close();
    }
  }
}
