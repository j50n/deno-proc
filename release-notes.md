# Release Notes

## 0.19.6

- Updated dependencies.

## 0.19.5

- Updated dependencies.

## 0.19.4

- Updated dependencies.

## 0.19.3

- Refactored to use `subarray` in all places where `slice` had been used,
  removing a lot of redundant memory copies.

## 0.19.2

- Performance improvement to byte array concatenation.

## 0.19.1

- Fix line split to correctly remove trailing carriage returns on lines and to
  remove an empty line at end of input.

## 0.19.0

- Add a few useful items to `mod.ts`.

## 0.18.0

This release contains breaking changes.

- Conversion function names changed to be more specific.

## 0.17.0

This release contains breaking changes.

- Iterable handlers have been renamed to include "async."
- Rework of short-form functions.

## 0.16.0

This release contains minor breaking changes.

- Dependency maintenance.
- Build is written in Typescript; no more shell builds.
- Added some short-form run functions.

## 0.15.0

This release contains minor breaking changes.

- `#23` **fix** Separators on Windows are "\r\n" and "\n" elsewhere.
- `#24` **enhancement** `stderr` handler now passes bytes rather than text.
- `#25` **enhancement** `stderr` handler can pass back something (`unknown`
  type) to be attached to the error, if there is an error.

To convert bytes to lines of text, you can use `proc.bytesToTextLines()`.

## 0.14.4

- **documentation** Various edits to documentation and examples.

## 0.14.3

- **documentation** Various edits to documentation and examples.

## 0.14.2

- **fix** Removed file.

## 0.14.1

- `#16` **documentation** Demonstrate using `aplay` to play `.wav` files.

## 0.14.0

- **feature** Support workers with `PushIterable`; includes example.

## 0.13.8

- **documentation** Fixed links in documentation.

## 0.13.7

- **documentation** Fixed a typo.

## 0.13.6

- **documentation** Added _Direct Control Over `stderr`_ section.
- **documentation** Added _Overriding the Default Exit-Code Error Handling
  Behavior_ section.

## 0.13.5

- `#16` **documentation** Minor documentation edits.

## 0.13.4

- `#16` **documentation** Example for string arrays.

## 0.13.3

- **documentation** Moved the _Key Concepts_ section.

## 0.13.2

- **documentation** Example with global `Group`.

## 0.13.1

- **feature** Minor refactor of line split code.
- **documentation** Simplified the initial example.

## 0.13.0

- `#15` **feature** Added `simpleRunner`.
- `#21` **feature** Supports a global process group by default; allows omitting
  group create/close boilerplate in most cases.

## 0.12.2

- `#16` **documentation** Continuing work on various examples.
- `#18` **documentation** Example showing decorating `stderr` and `stdout` in
  real time.

## 0.12.1

- **maint** Dependency maintenance.

## 0.12.0

- `#19` **enhancement** support for unbuffered input/output handlers (optional).
- `#20` **enhancement** `stderr` is unbuffered.

## 0.11.1

- `#17` **fix** `stringArrayInput()` performance.
- **maint** Dependency maintenance.

## 0.11.0

- `#14` **feature** Chained errors are optional and off by default.

## 0.10.0 _Prerelease_

This release contains breaking changes.

- **documentation** Multiple changes to the `README.md`.
- **feature** Added input and output support for `string[]`.
- **fix** Errors are chained through multiple connected processes.
- **fix** Errors are correctly proagated in examples.

## 0.9.2 _Prerelease_

There are no breaking API changes in this release.

- **documentation** Multiple changes to the `README.md`.

## 0.9.1 _Prerelease_

This release contains breaking changes.

- **feature** Usability. Moved the `Group` reference that was previously in the
  `run(...)` call to a bind call from the `runner` definition. Seems small, but
  makes a difference in readability.

## 0.8.0 _Prerelease_

This release contains breaking changes.

- **documentation** Added additional examples.
- **fix** Organized files at the top folder level.

## 0.7.0 _Prerelease_

This release contains breaking changes.

- **fix** Added defensive close to all process resources on process exit in
  output handlers.
- **fix** Added additional error traps for `Deno.errors.Interrupted`.
- **fix** Pulled some classes out of `mod.ts`. These are still available to be
  imported but will not be visible through `mod.ts`.
- **example** Added _War and Peace_ example.

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
