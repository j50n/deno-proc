export class ProcessExitError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly signal?: number,
    public readonly details?: string,
  ) {
    super(message + details === undefined ? "" : `\n${details}`);
    this.name = this.constructor.name;
  }
}
