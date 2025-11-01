# Documentation Test Markers

All code examples in the mdbook documentation now have HTML comment markers indicating their test status.

## Marker Types

### Tested Examples
```html
<!-- TESTED: tests/mdbook_examples.test.ts - "test-name" -->
```
These examples have corresponding tests in `tests/mdbook_examples.test.ts` and are verified to work correctly.

### Untested Examples
```html
<!-- NOT TESTED: Illustrative example -->
```
These examples are for illustration purposes and may:
- Show comparison code (e.g., Deno.Command vs proc)
- Demonstrate bad patterns (e.g., Promise.all without control)
- Be conceptual examples that don't need testing
- Require complex setup not suitable for automated testing

## Statistics

- **Tested examples**: 31
- **Untested examples**: 331
- **Total examples**: 362

## Tested Example Coverage

### Getting Started (6 tested)
- `quick-start.md`: All 6 main examples tested
- `key-concepts.md`: 2 key examples tested

### Core Features (6 tested)
- `running-processes.md`: 2 examples tested
- `pipelines.md`: 1 example tested (chain commands)
- `output.md`: 2 examples tested (map, filter)
- `input.md`: 1 example tested (pipe from enumerable)

### Iterables (11 tested)
- `enumerable.md`: 1 example tested (map)
- `array-methods.md`: 5 examples tested (flatMap, count, some, every, find)
- `transformations.md`: 1 example tested (async map)
- `aggregations.md`: 2 examples tested (reduce, build object)
- `slicing.md`: 3 examples tested (take, drop, drop+take)

### Advanced (2 tested)
- `concurrent.md`: 1 example tested (concurrentMap)
- `streaming.md`: 1 example tested (count lines)

### Utilities (4 tested)
- `file-io.md`: 1 example tested (read and filter)
- `range.md`: 2 examples tested (basic, with step)
- `zip-enumerate.md`: 1 example tested (enum)

### Recipes (2 tested)
- `decompression.md`: 1 example tested (War and Peace)
- `log-processing.md`: 1 example tested (count errors)

## How to Use These Markers

When reviewing documentation:

1. **TESTED markers** indicate the example is verified to work
   - You can copy-paste these with confidence
   - The test name tells you where to find the test
   
2. **NOT TESTED markers** indicate illustrative examples
   - These may need adaptation for your use case
   - They demonstrate concepts but aren't guaranteed to run as-is
   - Many are comparison examples showing alternative approaches

## Finding Tests

All tests are in: `tests/mdbook_examples.test.ts`

To run just the mdbook tests:
```bash
deno test --no-check --allow-all tests/mdbook_examples.test.ts
```

To run all tests:
```bash
deno test --no-check --allow-all
```

## Adding New Tests

When adding a new test for a documentation example:

1. Add the test to `tests/mdbook_examples.test.ts`
2. Update the marker in the documentation from:
   ```html
   <!-- NOT TESTED: Illustrative example -->
   ```
   to:
   ```html
   <!-- TESTED: tests/mdbook_examples.test.ts - "your-test-name" -->
   ```
3. Update this document's statistics

## Verification

All tested examples have been verified to match their documentation exactly.
See `MDBOOK_TEST_VERIFICATION.md` for detailed verification report.
