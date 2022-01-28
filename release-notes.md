# Release Notes

## 0.7.0 _Prerelease_

 - **fix** Added defensive close to all process resources on process exit in output handlers.


## 0.6.1 _Prerelease_

This release contains breaking changes.

- `#13` **fix** The error message returned from a failed process has been fixed.
- `#12` **feature** Runners can be defined with custom error handling.
- `#10` **feature** Processes are removed from their group when they close
  naturally (output is exhausted).

## 0.5.0 _Prerelease_

This release contains breaking changes.

- **fix** Renamed `ProcGroup` to `Group`.
- **fix** Renamed `Proc` to `Runner`.

## 0.4.0 _Prerelease_

This release contains breaking changes.

- **fix** `ReaderInputHandler` no longer requires the input reader to implement
  `Deno.Closer`. It just uses a plain `Deno.Reader` now.
- **fix** `ProcGroup` unload events are now being called on exit. Long running
  child processes are now correctly shut down when the Deno process exits due to
  a call to `Deno.exit()`.

## 0.3.0 _Prerelease_

This release contains breaking changes. There are trivial changes to the case of
factory functions to match the style guide.

- **fix** Case change on factory functions to match the style guide.

## 0.2.0 _Prerelease_

There are no breaking API changes in this release.

- **feature** Specialized the error for process failures to `ProcessExitError`.
  Previously this was a plain `Error`.

## 0.1.0 _Prerelease_

Initial release of the new API.
