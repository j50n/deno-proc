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
