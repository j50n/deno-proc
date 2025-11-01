# Documentation Rules

## Core Principles

1. **Every public API must have JSDoc with a working example**
2. **Every example must have a corresponding test in `tests/docs/`**
3. **Examples must be minimal and focused on one concept**
4. **Documentation must explain WHY, not just WHAT**

## JSDoc Structure

### Required Elements

````typescript
/**
 * Brief one-line description.
 *
 * Longer explanation of purpose and use cases.
 * Explain why someone would use this over alternatives.
 *
 * @example Brief description of example
 * ```typescript
 * import { function } from "jsr:@j50n/proc";
 *
 * // Working code that can be copy-pasted
 * const result = await function();
 * // Expected output as comment
 * ```
 *
 * @param paramName Description of parameter.
 * @returns Description of return value.
 */
````

### Style Guidelines

- **First line**: One sentence summary
- **Body**: 2-4 sentences explaining purpose and benefits
- **Examples**: Must be runnable, use `jsr:@j50n/proc` imports
- **Comparisons**: Highlight advantages over `Deno.Command` where relevant
- **Tone**: Direct and actionable, skip flattery

## Testing Requirements

### Test File Organization

- Location: `tests/docs/[module-name].test.ts`
- One test file per source file
- Test names match example descriptions
- Additional edge case tests in `tests/docs/additional-coverage.test.ts`

### Test Coverage Standards

**Every public function must have tests for:**
- ✅ Happy path (basic functionality)
- ✅ Edge cases (empty, null, undefined, single element)
- ✅ Error conditions (invalid input, boundary violations)
- ✅ Type variations (when applicable)

**Critical: Functions matching JavaScript APIs (like reduce) must:**
- Match JavaScript behavior exactly
- Test all parameter combinations
- Test falsy values (0, "", false, null, undefined)
- Test index/accumulator behavior
- Include real-world use case examples

### Test Structure

```typescript
import { assertEquals } from "@std/assert";
import { function } from "../../src/module.ts";

Deno.test("function - brief description", async () => {
  // Exact code from JSDoc example (or paraphrased if needed)
  const result = await function();
  
  // Verify expected behavior
  assertEquals(result, expectedValue);
});
```

### Test Verification

Before committing documentation:

```bash
deno test --allow-run --allow-read --allow-write tests/docs/
```

All tests must pass.

## AI-Friendly Documentation

Documentation should enable an AI to:

1. Understand when to use this library vs alternatives
2. Generate correct usage code without trial and error
3. Understand error handling patterns
4. Know about resource management (closing, cleanup)

### Key Points to Emphasize

- **Composability**: Method chaining and fluent APIs
- **Error handling**: How errors propagate and can be customized
- **Resource management**: Automatic cleanup, when to call close()
- **Performance**: When to use buffering, concurrency options
- **Type safety**: How types flow through transformations

## Maintenance Workflow

### Before Committing Changes

**Always run `./build.sh` before committing.** This script:

- Updates Rust/Cargo to latest version
- Updates mdbook (if newer version available)
- Updates Deno to latest version
- Formats all TypeScript and Markdown files
- Fixes shebang patterns
- Lints all TypeScript files
- Type-checks all TypeScript files
- Runs all tests with proper permissions

**For documentation site:** Run `./build-site.sh` to build the mdbook documentation.

### Adding New APIs

1. Write the function/method
2. Add JSDoc with example
3. Create test in `tests/docs/` that verifies the example
4. Run `./build.sh` to verify everything passes
5. Commit together

### Updating Existing APIs

1. Update the code
2. Update JSDoc and examples
3. Update or add tests
4. Run `./build.sh` to verify everything passes
5. Commit together

### Reviewing PRs

Check that:

- [ ] `./build.sh` passes successfully
- [ ] New public APIs have JSDoc
- [ ] JSDoc includes working examples
- [ ] Examples have corresponding tests
- [ ] Tests pass
- [ ] Documentation explains WHY not just WHAT
- [ ] Edge cases are tested (empty, null, single element)
- [ ] Error conditions are tested
- [ ] Functions matching JS APIs behave identically

## Common Bugs to Watch For

Based on code reviews, watch for these patterns:

### Algorithm Implementations
- **Fisher-Yates shuffle**: Must select from unshuffled portion only
  ```typescript
  // ❌ WRONG
  const j = Math.floor(Math.random() * items.length);
  
  // ✅ CORRECT
  const j = Math.floor(Math.random() * (items.length - i)) + i;
  ```

### Infinite Loop Prevention
- **Range/iteration functions**: Always validate step !== 0
  ```typescript
  if (step === 0) {
    throw new RangeError("step cannot be 0");
  }
  ```

### Empty Collection Handling
- **Reduce with initial value**: Must return initial value for empty collections
  ```typescript
  // Initialize acc with zero if provided
  let acc = zero !== undefined ? zero : UNSET;
  ```

### Async Generator Errors
- **Validation timing**: Validate parameters before creating async generator
  ```typescript
  // ✅ Validate here (synchronous)
  if (invalid) throw new Error();
  
  async function* generator() {
    // ❌ Not here (async, harder to test)
  }
  ```

## Example Quality Checklist

- [ ] Example is minimal (no unnecessary code)
- [ ] Example is complete (can be copy-pasted)
- [ ] Example shows real-world usage
- [ ] Example includes expected output as comment
- [ ] Example uses `jsr:@j50n/proc` imports
- [ ] Example has a test in `tests/docs/`
- [ ] Test passes

## Anti-Patterns to Avoid

❌ **Don't**: Write examples that can't be tested ❌ **Don't**: Use placeholder
values like `...` in examples ❌ **Don't**: Explain only WHAT the function does
❌ **Don't**: Write verbose, academic documentation ❌ **Don't**: Skip error
handling in examples when relevant

✅ **Do**: Write minimal, working, tested examples ✅ **Do**: Explain WHY
someone would use this ✅ **Do**: Show real-world use cases ✅ **Do**: Keep
descriptions succinct ✅ **Do**: Include error handling when it's important
