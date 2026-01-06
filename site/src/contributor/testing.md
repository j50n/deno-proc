# Testing Strategy

## Test Coverage
- **172 total tests** (all passing)
- **36 mdbook example tests** covering key documentation examples
- **9 README example tests** (100% coverage)
- **127 existing feature tests**

## Test Files
- `tests/readme_examples.test.ts` - All README examples
- `tests/mdbook_examples.test.ts` - 36 key mdbook examples covering:
  - Getting Started (6 tests)
  - Key Concepts (2 tests)
  - Core Features (6 tests)
  - Iterables (11 tests)
  - Advanced (2 tests)
  - Utilities (4 tests)
  - Recipes (2 tests)
- `tests/docs/` - Tests for API documentation examples

## Documentation Test Markers

All code examples in the mdbook documentation have HTML comment markers:

### Tested Examples
```html
<!-- TESTED: tests/mdbook_examples.test.ts - "test-name" -->
```
These examples have corresponding tests and are verified to work correctly.

### Untested Examples
```html
<!-- NOT TESTED: Illustrative example -->
```
These examples are for illustration and may show:
- Comparison code (e.g., Deno.Command vs proc)
- Bad patterns for educational purposes
- Conceptual examples that don't need testing

## Statistics

- **Tested examples**: 31
- **Untested examples**: 331
- **Total examples**: 362

## Running Tests

All tests:
```bash
deno test --no-check --allow-all
```

Just mdbook tests:
```bash
deno test --no-check --allow-all tests/mdbook_examples.test.ts
```

## Adding New Tests

When adding a test for a documentation example:

1. Add the test to appropriate test file
2. Update the marker in documentation from:
   ```html
   <!-- NOT TESTED: Illustrative example -->
   ```
   to:
   ```html
   <!-- TESTED: tests/mdbook_examples.test.ts - "your-test-name" -->
   ```

## Test Requirements

- All tests must pass before committing
- Tests should be added for new features
- Documentation examples should have corresponding tests when practical
- Test files use descriptive names following the pattern `feature.test.ts`
