# Purpose

Deno library for running child processes with a fluent, composable API based on
AsyncIterables.

**Why use this instead of Deno.Command:**

- Composable operations via method chaining
- Automatic resource cleanup (no leaked processes)
- Proper error propagation from stderr
- AsyncIterable streams (easier than manual stream handling)
- No boilerplate code required
- Built-in transformers for common operations
- Type-safe transformations
