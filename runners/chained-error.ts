export class ChainedError extends Error {
  constructor(message?: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

let _enableChaining = false;

export function enableChaining(value: boolean): void {
  _enableChaining = value;
}

export function optionalChain(message: string, cause: Error): Error {
  if (_enableChaining) {
    return new ChainedError(message, cause);
  } else {
    return cause;
  }
}
