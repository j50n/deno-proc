# Documentation Rules

## Core Principles

1. **Every public API must have JSDoc with a working example**
2. **Every example must have a corresponding test**
3. **Examples must be minimal and focused on one concept**
4. **Documentation must explain WHY, not just WHAT**
5. **Error handling is the PRIMARY selling point**

---

## Part 1: Writing JSDoc

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

### Critical API Clarifications

**Always clarify in JSDoc:**

1. **Properties vs Methods**
   - Properties: "This is a property, not a method. Use `.lines` not `.lines()`"
   - Include examples showing correct usage without parentheses

2. **Error Handling**
   - Explain that errors propagate naturally through pipelines
   - Show try-catch at the end, not at each step
   - Emphasize: "No separate error channels or callbacks needed"

3. **Resource Management**
   - State explicitly: "Always consume output via `.collect()`, `.forEach()`, etc."
   - Warn about resource leaks from unconsumed output

4. **Enumeration Pattern**
   - Clarify: "`enumerate()` wraps iterables but does NOT add indices"
   - Explain: "Call `.enum()` to get `[item, index]` tuples"

5. **Process Chaining**
   - Use `.run()` method to chain processes (not `.pipe()`)
   - Explain stdin/stdout piping behavior

---

## Part 2: Writing Tests

### Test File Organization

**For JSDoc examples:**
- Location: `tests/docs/[module-name].test.ts`
- One test file per source file
- Test names match example descriptions
- Additional edge case tests in `tests/docs/additional-coverage.test.ts`

**For README examples:**
- Location: `tests/readme_examples.test.ts`
- Every README example must have a test
- Tests verify examples work exactly as shown

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

Before committing:

```bash
deno test --allow-run --allow-read --allow-write
```

All tests must pass.

---

## Part 3: README Requirements

The README must prominently feature:

### 1. Error Handling as PRIMARY Selling Point

- Lead with: "Errors that just work"
- Include: "JavaScript streaming is fast, but error handling shouldn't break your brain"
- Show error propagation in opening example
- Demonstrate multi-step pipeline with single try-catch

### 2. Streaming Capabilities

- Show real-world example (e.g., decompressing large files)
- Demonstrate integration with Web Streams API
- Highlight performance and memory efficiency

### 3. Key Concepts Section

Must explain:
- Properties vs methods distinction
- Resource management requirements
- Error handling behavior
- Enumeration pattern (enumerate() vs .enum())

### 4. All Examples Must Be Tested

- Every README example needs a test in `tests/readme_examples.test.ts`
- Tests verify examples work exactly as shown
- Use `--no-check` flag if needed for Web Streams compatibility

---

## Part 4: Maintenance Workflow

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
- [ ] Properties vs methods are clearly documented
- [ ] Error propagation is explained
- [ ] Resource management is documented

---

## Part 5: Common Pitfalls

### Algorithm Implementations

**Fisher-Yates shuffle**: Must select from unshuffled portion only
```typescript
// ❌ WRONG
const j = Math.floor(Math.random() * items.length);

// ✅ CORRECT
const j = Math.floor(Math.random() * (items.length - i)) + i;
```

### Infinite Loop Prevention

**Range/iteration functions**: Always validate step !== 0
```typescript
if (step === 0) {
  throw new RangeError("step cannot be 0");
}
```

### Empty Collection Handling

**Reduce with initial value**: Must return initial value for empty collections
```typescript
// Initialize acc with zero if provided
let acc = zero !== undefined ? zero : UNSET;
```

### Async Generator Errors

**Validation timing**: Validate parameters before creating async generator
```typescript
// ✅ Validate here (synchronous)
if (invalid) throw new Error();

async function* generator() {
  // ❌ Not here (async, harder to test)
}
```

---

## Part 6: Quality Checklists

### Example Quality

- [ ] Example is minimal (no unnecessary code)
- [ ] Example is complete (can be copy-pasted)
- [ ] Example shows real-world usage
- [ ] Example includes expected output as comment
- [ ] Example uses `jsr:@j50n/proc` imports
- [ ] Example has a test in `tests/docs/` or `tests/readme_examples.test.ts`
- [ ] Test passes

### Documentation Quality

- [ ] Explains WHY, not just WHAT
- [ ] Clarifies properties vs methods
- [ ] Explains error propagation
- [ ] Documents resource management
- [ ] Includes working examples
- [ ] Examples are tested
- [ ] Tone is direct and actionable

---

## Part 7: Anti-Patterns

### Don't

❌ Write examples that can't be tested  
❌ Use placeholder values like `...` in examples  
❌ Explain only WHAT the function does  
❌ Write verbose, academic documentation  
❌ Skip error handling in examples when relevant  
❌ Document methods as if they were properties (or vice versa)  
❌ Forget to mention resource management requirements  

### Do

✅ Write minimal, working, tested examples  
✅ Explain WHY someone would use this  
✅ Show real-world use cases  
✅ Keep descriptions succinct  
✅ Include error handling when it's important  
✅ Clarify properties vs methods  
✅ Explain error propagation patterns  
✅ Document resource management  

---

## Part 8: AI-Friendly Documentation

Documentation should enable an AI to:

1. Understand when to use this library vs alternatives
2. Generate correct usage code without trial and error
3. Understand error handling patterns
4. Know about resource management requirements
5. Distinguish between properties and methods
6. Understand the enumeration pattern

### Key Points to Emphasize

- **Error propagation**: Errors flow through pipelines like data - handle once at the end
- **Properties vs methods**: `.lines`, `.status`, `.first` are properties; `.collect()`, `.map()` are methods
- **Resource management**: Always consume process output to avoid leaks
- **Composability**: Method chaining and fluent APIs
- **Type safety**: How types flow through transformations
- **Performance**: When to use buffering, concurrency options

---

## Part 9: mdbook Documentation

The mdbook provides comprehensive user documentation at https://j50n.github.io/deno-proc/

### Structure

8 sections organized by user journey:
1. Getting Started - Installation, quick start, key concepts
2. Core Features - Error handling, processes, pipelines, I/O
3. Async Iterables - Enumerable, Array methods, transformations
4. Advanced Topics - Concurrency, streaming, custom errors
5. Utilities - File I/O, range, enumerate, cache
6. Recipes - Real-world examples and solutions
7. API Reference - Complete API documentation
8. Other - Migration guide, FAQ

### Writing Style

**Warm and Human**
- Conversational, not academic
- Use "you" and "we"
- Explain why, not just what
- Show empathy for struggles

**Compelling**
- Start with the problem
- Show the solution
- Demonstrate the benefit
- Real-world examples

**Practical**
- Copy-paste ready code
- Complete, working examples
- Common patterns
- Real use cases

**Progressive**
- Simple → Complex
- Build gradually
- Link related topics
- Provide next steps

### Key Principles

1. **Error handling first** - It's the primary selling point
2. **Show, don't tell** - Working examples over explanations
3. **Clarify properties vs methods** - Always distinguish
4. **Complete examples** - Copy-paste ready
5. **Real-world focus** - Realistic use cases

### Building

```bash
cd site
mdbook build
# Or
./build-site.sh
```

### Testing

All mdbook examples should be tested in `tests/docs/` before publishing.

See `MDBOOK_GUIDE.md` for complete guidelines.

