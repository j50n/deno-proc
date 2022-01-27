let _debug = false;

export function enableDebugMessages(): void {
  _debug = true;
}

export function debug(): boolean {
  return _debug;
}
