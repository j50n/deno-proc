# Documentation Testing Strategy

## Test Coverage
- **172 total tests** (136 existing + 36 mdbook examples)
- **100% passing** in 3 seconds
- **README examples**: 9/9 tested (100%)
- **Mdbook examples**: 36 key examples tested

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

## Documentation Markers
All mdbook code examples have HTML comment markers:
- `<!-- TESTED: tests/mdbook_examples.test.ts - "test-name" -->` - Verified examples
- `<!-- NOT TESTED: Illustrative example -->` - Illustrative/comparison examples

Statistics:
- **31 tested examples** - Copy-paste ready, verified to work
- **331 untested examples** - Illustrative, comparison, or conceptual

## Key Learnings

### API Corrections
1. **No `.slice()` method exists** - Use `.drop().take()` instead
   - Fixed in `site/src/iterables/slicing.md`
   - Test: "slicing: slice with drop and take"

### Documentation Patterns
1. **Properties vs methods** - `.lines`, `.status`, `.first` are properties (no parentheses)
2. **Comparison examples** - Examples showing Deno.Command vs proc are illustrative only
3. **Bad pattern examples** - Examples with "might crash" comments are demonstrative
4. **Test markers** - Help readers know which examples are copy-paste ready

### Testing Strategy
1. **Test user-facing examples** - Focus on examples users will copy-paste
2. **Skip comparison code** - Don't test Deno.Command examples
3. **Skip bad patterns** - Don't test examples demonstrating what NOT to do
4. **Mock appropriately** - Use temp files, mock fetch, replace system commands

## Documentation Files
- `MDBOOK_TEST_VERIFICATION.md` - Detailed verification of all tested examples
- `DOCUMENTATION_TEST_MARKERS.md` - Guide to test markers in documentation
- `DOCUMENTATION_TESTING.md` - This file, testing strategy overview

## Running Tests

```bash
# All tests
deno test --no-check --allow-all

# Just mdbook examples
deno test --no-check --allow-all tests/mdbook_examples.test.ts

# Just README examples
deno test --allow-all tests/readme_examples.test.ts
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
3. Update statistics in `DOCUMENTATION_TEST_MARKERS.md`
4. Verify the example matches the documentation exactly

## Maintenance

- Run tests before every release
- Update tests when API changes
- Keep documentation markers in sync with tests
- Verify new examples are either tested or marked as illustrative
