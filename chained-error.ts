export class ChainedError extends Error {
  constructor(message?: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}
