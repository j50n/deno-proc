# Contributing to proc

This section contains documentation for maintainers and contributors to the proc library.

## Overview

The proc library provides a fluent API for running child processes and working with async iterables in Deno. It emphasizes composable operations, automatic resource cleanup, and proper error propagation.

**Key Goals:**
- Composable operations via method chaining
- Automatic resource cleanup (no leaked processes)
- Proper error propagation from stderr
- AsyncIterable streams (easier than manual stream handling)
- Type-safe transformations with minimal boilerplate

## Quick Navigation

- [Project Architecture](./architecture.md) - Core modules and design concepts
- [Coding Standards](./coding-standards.md) - TypeScript standards, testing, and workflows
- [API Design](./api-design.md) - Patterns and conventions for the public API
- [Documentation Guidelines](./documentation.md) - How to write and maintain docs
- [Testing Strategy](./testing.md) - Test coverage and verification approach
- [Build Process](./build-process.md) - Building, releasing, and maintaining the project
